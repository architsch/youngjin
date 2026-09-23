import * as THREE from "three";
import App from "../../app";
import GraphicsManager from "../../graphics/graphicsManager";
import CameraUtil from "../../graphics/util/cameraUtil";
import PointerCoordUtil from "../../graphics/util/pointerCoordUtil";
import ObjectAttachmentEditGizmos from "../../graphics/types/gizmo/objectAttachmentEditGizmos";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import ClientObjectManager from "../../object/clientObjectManager";
import GameObject from "../../object/types/gameObject";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import RoomPrefsUtil from "../../../shared/room/util/roomPrefsUtil";
import ThingsPoolEnv from "../types/thingsPoolEnv";
import { gameModeObservable, objectSelectionObservable,
    voxelQuadSelectionObservable } from "../clientObservables";

// Read-only automation surface (window.__thingspool_automation) for playtests and screenshot capture:
// reports what the room holds, where it is on screen, what a pixel's raycast meets, and the current
// selection. It never acts; callers issue real pointer gestures so clicks run the player's code path.
// Metadata is reported under the shared enum key names. Being read-only makes the gate below hygiene,
// not security.

const objectWorldTemp = new THREE.Vector3();
const cameraWorldTemp = new THREE.Vector3();
const screenTemp = new THREE.Vector2();

const metadataNameByKey: {[key: number]: string} = {};
for (const [name, key] of Object.entries(ObjectMetadataKeyEnumMap))
    metadataNameByKey[key] = name;

// World point to viewport coordinates (as pointer events use); null if behind the camera.
function toScreen(worldPosition: THREE.Vector3): {x: number, y: number} | null
{
    const screen = PointerCoordUtil.worldToClient(worldPosition, screenTemp);
    return screen == null ? null : {x: screen.x, y: screen.y};
}

function getObjectType(gameObject: GameObject): string
{
    return ObjectTypeConfigMap.getConfigByIndex(gameObject.params.objectTypeIndex).objectType;
}

function readMetadata(gameObject: GameObject): {[name: string]: string}
{
    const out: {[name: string]: string} = {};
    for (const [key, value] of Object.entries(gameObject.params.metadata))
        out[metadataNameByKey[Number(key)] ?? key] = value.str;
    return out;
}

function describeObject(gameObject: GameObject): Record<string, unknown>
{
    gameObject.obj.getWorldPosition(objectWorldTemp);
    GraphicsManager.getCamera().getWorldPosition(cameraWorldTemp);
    const distance = objectWorldTemp.distanceTo(cameraWorldTemp);
    const screen = toScreen(objectWorldTemp);

    return {
        objectId: gameObject.params.objectId,
        objectType: getObjectType(gameObject),
        world: {x: objectWorldTemp.x, y: objectWorldTemp.y, z: objectWorldTemp.z},
        scale: {...gameObject.params.transform.scale},
        screen,
        // Whether the pointer could actually get to that pixel, which the cast alone cannot say.
        ...(screen == null ? {overCanvas: false, coveredBy: "(behind the camera)"}
            : whatIsOnTopAt(screen.x, screen.y)),
        inFieldOfView: CameraUtil.pointIsInFieldOfView(objectWorldTemp),
        inLineOfSight: CameraUtil.objectIsInLineOfSight(objectWorldTemp, gameObject),
        distance,
        // Out-of-reach clicks silently do nothing.
        withinSelectRange: true,
        metadata: readMetadata(gameObject),
    };
}

// What a click at this pixel would hit, via the click's own cast (no synthetic event). Null if nothing.
function probeAt(clientX: number, clientY: number): Record<string, unknown> | null
{
    const intersection = CameraUtil.castFromPointer({clientX, clientY} as PointerEvent);
    if (intersection == undefined)
        return null;

    GraphicsManager.getCamera().getWorldPosition(cameraWorldTemp);
    const gameObject = CameraUtil.getObjectFromIntersection(intersection);
    const distance = intersection.point.distanceTo(cameraWorldTemp);

    return {
        screen: {x: clientX, y: clientY},
        // Empty for gizmos (geometry with no object).
        objectId: gameObject?.params.objectId ?? "",
        objectType: gameObject == undefined ? "" : getObjectType(gameObject),
        instanceId: intersection.instanceId ?? -1,
        world: {x: intersection.point.x, y: intersection.point.y, z: intersection.point.z},
        distance,
        withinSelectRange: true,
        ...whatIsOnTopAt(clientX, clientY),
    };
}

// Which DOM element would actually receive a click at this pixel (the HUD, popups and CSS2D elements
// sit above the canvas). Only meaningful together with probeAt.
function whatIsOnTopAt(clientX: number, clientY: number): Record<string, unknown>
{
    const canvas = GraphicsManager.getGameCanvas();
    const topElement = document.elementFromPoint(clientX, clientY);
    return {
        overCanvas: topElement === canvas,
        // Named so a caller can say what got in the way rather than only that something did.
        coveredBy: topElement === canvas ? "" :
            (topElement == null ? "(outside the window)"
                : `${topElement.tagName.toLowerCase()}${topElement.id ? `#${topElement.id}` : ""}`),
    };
}

const AutomationBridgeUtil =
{
    // Only on non-public deployments (see IS_PUBLIC_SITE).
    install: (env: ThingsPoolEnv): void =>
    {
        if (env.mode != "dev" && env.serverType != "Staging")
            return;

        (window as any).__thingspool_automation = {
            // Poll this instead of sleeping; room load time varies.
            ready: () =>
            {
                const room = App.getCurrentRoom();
                return {
                    room: room != undefined,
                    roomID: room?.id ?? "",
                    myPlayer: ClientObjectManager.getMyPlayer() != undefined,
                    objectCount: room == undefined ? 0 : Object.keys(room.objectGroup.objectById).length,
                };
            },

            // User, position and current permissions (permissions depend on the room, so they're
            // reported rather than inferred from user type).
            context: () =>
            {
                const user = App.getUser();
                const room = App.getCurrentRoom();
                return {
                    serverType: env.serverType,
                    gitCommit: env.gitCommit,
                    user: user == undefined ? null : {
                        id: user.id,
                        userName: user.userName,
                        userType: user.userType,
                    },
                    room: room == undefined ? null : {
                        id: room.id,
                        roomName: room.roomName,
                        roomType: room.roomType,
                        ownerUserID: room.ownerUserID,
                        ownerUserName: room.ownerUserName,
                        texturePackPath: room.texturePackPath,
                        // Decoded (like zones below), since callers check the room, not the wire format.
                        lighting: RoomPrefsUtil.decode(room.prefs),
                        restrictedZones: room.voxelGrid.restrictedZones.map(zone => ({
                            rowMin: zone.rowMin, rowMax: zone.rowMax,
                            colMin: zone.colMin, colMax: zone.colMax,
                        })),
                    },
                    gameMode: gameModeObservable.peek(),
                    isAdmin: user != undefined && RoomValidationUtil.userIsAdmin(user),
                    canManageDoors: user != undefined && room != undefined &&
                        RoomValidationUtil.canUserManageDoors(user, room),
                    isRoomSuperuser: user != undefined && room != undefined &&
                        RoomValidationUtil.isRoomSuperuser(user, room),
                };
            },

            // Room objects with aim pixels and reachability, optionally filtered by objectType.
            objects: (objectType?: string) =>
            {
                const room = App.getCurrentRoom();
                if (room == undefined)
                    return [];

                const reports: Record<string, unknown>[] = [];
                for (const objectId of Object.keys(room.objectGroup.objectById))
                {
                    const gameObject = ClientObjectManager.getObjectById(objectId);
                    if (gameObject == undefined)
                        continue; // Named by the room but not yet spawned into it.
                    if (objectType != undefined && getObjectType(gameObject) != objectType)
                        continue;
                    reports.push(describeObject(gameObject));
                }
                return reports;
            },

            // Explains a no-op click: wrong target, nothing, or out of reach.
            probe: (clientX: number, clientY: number) => probeAt(clientX, clientY),

            // probe across a grid of the view in one round trip, for finding somewhere to aim.
            probeGrid: (options?: {cols?: number, rows?: number, margin?: number}) =>
            {
                const cols = options?.cols ?? 9;
                const rows = options?.rows ?? 7;
                const margin = options?.margin ?? 0.12; // Fraction of the canvas left out at each edge.
                const rect = GraphicsManager.getGameCanvas().getBoundingClientRect();

                const hits: Record<string, unknown>[] = [];
                for (let row = 0; row < rows; row++)
                {
                    for (let col = 0; col < cols; col++)
                    {
                        const u = margin + (1 - 2 * margin) * (cols == 1 ? 0.5 : col / (cols - 1));
                        const v = margin + (1 - 2 * margin) * (rows == 1 ? 0.5 : row / (rows - 1));
                        const hit = probeAt(rect.left + u * rect.width, rect.top + v * rect.height);
                        if (hit != null)
                            hits.push(hit);
                    }
                }
                return hits;
            },

            // Confirms a gesture landed (the HUD follows the selection).
            selection: () =>
            {
                const objectSelection = objectSelectionObservable.peek();
                const quadSelection = voxelQuadSelectionObservable.peek();
                return {
                    // The user's character is reported as an ordinary object of its type.
                    object: objectSelection == null ? null
                        : describeObject(objectSelection.gameObject),
                    voxelQuad: quadSelection == null ? null : {
                        col: quadSelection.voxel.col,
                        row: quadSelection.voxel.row,
                        quadIndex: quadSelection.quadIndex,
                    },
                };
            },

            // Where the selected attached object can be dragged from: its middle moves it, a corner resizes
            // it (when canResize). Null when the selection is nothing this user may drag.
            selectionGizmo: () => ObjectAttachmentEditGizmos.getGrabPoints(),

            // Camera position, selection reach, and canvas rect.
            camera: () =>
            {
                const camera = GraphicsManager.getCamera();
                camera.getWorldPosition(cameraWorldTemp);
                const rect = GraphicsManager.getGameCanvas().getBoundingClientRect();
                return {
                    world: {x: cameraWorldTemp.x, y: cameraWorldTemp.y, z: cameraWorldTemp.z},
                    fov: camera.fov,
                    maxSelectDistance: true,
                    canvas: {left: rect.left, top: rect.top, width: rect.width, height: rect.height},
                };
            },
        };
    },
}

export default AutomationBridgeUtil;
