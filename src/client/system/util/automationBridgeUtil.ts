import * as THREE from "three";
import App from "../../app";
import GraphicsManager from "../../graphics/graphicsManager";
import CameraUtil from "../../graphics/util/cameraUtil";
import PointerCoordUtil from "../../graphics/util/pointerCoordUtil";
import SelectionEditGizmoUtil from "../../graphics/util/selectionEditGizmoUtil";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import ClientObjectManager from "../../object/clientObjectManager";
import GameObject from "../../object/types/gameObject/gameObject";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import RestrictedZoneUtil from "../../../shared/voxel/util/restrictedZoneUtil";
import VolumeObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import { COLLISION_LAYER_MAX, COLLISION_LAYER_MIN } from "../../../shared/system/sharedConstants";
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
const facePointTemp = new THREE.Vector3();
const screenTemp = new THREE.Vector2();

// Points per side of the grid findClickPoint tries over a face (odd, so that the middle is one of them).
const CLICK_POINT_GRID_SIDE = 9;

const metadataNameByKey: {[key: number]: string} = {};
for (const [name, key] of Object.entries(ObjectMetadataKeyEnumMap))
    metadataNameByKey[key] = name;

// World point to viewport coordinates (as pointer events use); null if behind the camera.
function toScreen(worldPosition: THREE.Vector3): {x: number, y: number} | null
{
    const screen = PointerCoordUtil.worldToClient(worldPosition, screenTemp);
    return screen == null ? null : {x: screen.x, y: screen.y};
}

// The layer of the block a quad is a face of; null for the room's own floor or ceiling.
function getBlockLayer(quadIndex: number): number | null
{
    const collisionLayer = VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);
    return (collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX) ? null : collisionLayer;
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

// Where a click would reach the object: its middle, or else the nearest of a grid of points over an attached
// object's face, since a click goes through a picture where its image is see-through (see CameraUtil). Null
// if a click reaches it at none of them.
function findClickPoint(gameObject: GameObject): {x: number, y: number} | null
{
    const params = gameObject.params;
    const attached = ObjectTypeConfigMap.getConfigByIndex(params.objectTypeIndex).attachment != undefined;
    const size = ObjectScaleUtil.getObjectSize(params.objectTypeIndex, params.transform.scale);
    const {right, up} = Geometry3DUtil.getAxisFacingBasis(params.transform.dir);

    // Across the face along its right and up, as shares of its size, nearest the middle first.
    const numPerSide = attached ? CLICK_POINT_GRID_SIDE : 1;
    const offsets: {x: number, y: number}[] = [];
    for (let i = 0; i < numPerSide * numPerSide; ++i)
    {
        offsets.push({x: ((i % numPerSide) + 0.5) / numPerSide - 0.5,
            y: (Math.floor(i / numPerSide) + 0.5) / numPerSide - 0.5});
    }
    offsets.sort((a, b) => (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y));

    gameObject.obj.getWorldPosition(objectWorldTemp);
    for (const offset of offsets)
    {
        const alongRight = offset.x * size.x;
        const alongUp = offset.y * size.y;
        const screen = toScreen(facePointTemp.set(
            objectWorldTemp.x + right.x * alongRight + up.x * alongUp,
            objectWorldTemp.y + right.y * alongRight + up.y * alongUp,
            objectWorldTemp.z + right.z * alongRight + up.z * alongUp));
        const hit = (screen == null) ? null : probeAt(screen.x, screen.y);
        if (hit != null && hit.objectId === params.objectId && hit.overCanvas)
            return screen;
    }
    return null;
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
    // Only on non-public deployments.
    install: (env: ThingsPoolEnv): void =>
    {
        if (App.isPublicSite())
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
                        restrictedZones: Object.values(room.objectById).filter(RestrictedZoneUtil.isZone)
                            .map(zone => ({
                                objectId: zone.objectId,
                                ...VolumeObjectTypeConfig.util.getRoomVolume(zone.transform),
                                userName: VolumeObjectTypeConfig.util.getZoneUserName(zone),
                            })),
                    },
                    gameMode: gameModeObservable.peek(),
                    isAdmin: user != undefined && RoomValidationUtil.userIsAdmin(user),
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

            // A pixel to click an object at (see findClickPoint), since its middle is not always one. Null if
            // there is none, or no such object.
            clickPoint: (objectId: string) =>
            {
                const gameObject = ClientObjectManager.getObjectById(objectId);
                return gameObject == undefined ? null : findClickPoint(gameObject);
            },

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
                    // facing: the way the face looks ("+x", "-y", …). collisionLayer: its block's, or null for
                    // the room's own floor or ceiling, which is no block's face.
                    voxelQuad: quadSelection == null ? null : {
                        col: quadSelection.voxel.col,
                        row: quadSelection.voxel.row,
                        quadIndex: quadSelection.quadIndex,
                        collisionLayer: getBlockLayer(quadSelection.quadIndex),
                        facing: VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadSelection.quadIndex) +
                            VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadSelection.quadIndex),
                    },
                };
            },

            // Whether a cell layer holds a block; null for one outside the room.
            hasBlock: (row: number, col: number, collisionLayer: number) =>
            {
                const room = App.getCurrentRoom();
                if (room == undefined || VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col) == undefined ||
                    collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX)
                {
                    return null;
                }
                return VoxelQueryUtil.isVoxelBlockPresentAt(room.voxelGrid.voxels, row, col, collisionLayer);
            },

            // Where the selection can be dragged from: an object's middle moves it, and a handle resizes the
            // selection (when canResize). Null when the selection is nothing this user may drag.
            selectionGizmo: () => SelectionEditGizmoUtil.getGrabPoints(),

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
