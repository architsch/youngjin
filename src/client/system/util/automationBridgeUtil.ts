import * as THREE from "three";
import App from "../../app";
import GraphicsManager from "../../graphics/graphicsManager";
import CameraUtil from "../../graphics/util/cameraUtil";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import ClientObjectManager from "../../object/clientObjectManager";
import GameObject from "../../object/types/gameObject";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import ThingsPoolEnv from "../types/thingsPoolEnv";
import { gameModeObservable, objectSelectionObservable, playerSelectionObservable,
    voxelQuadSelectionObservable } from "../clientObservables";

//------------------------------------------------------------------------
// A read-only window onto what the running client can see, for anything that drives the game from
// outside it: automated play, and the scripted runs that capture screenshots.
//
// It exists to close one gap, and it is the same gap in both cases. Everything in the world is
// reached by aiming at it — a door, a picture, a block, the patch of wall a new thing will hang on —
// and where any of that lands on screen depends on the room that was generated. A caller therefore
// has nothing to aim at and no way to tell whether what it wanted is even in view, while the HUD
// that follows a selection is ordinary DOM carrying stable element ids and needs no help at all.
// What is missing is not a way to act; it is a way to know where, and whether it is worth acting.
//
// So this answers *where*, and only that. It reports what the room holds and where each of it falls
// on screen, what a ray through a given pixel meets, and what is currently selected. It selects
// nothing, sends nothing, and moves nothing — a caller still has to produce a real gesture on the
// canvas, which is what makes the click it performs run the same path a player's does: the tap
// arbitration, the raycast, the object's own handler, and the permission check inside that. A bridge
// that performed the action instead would prove that the bridge works and nothing else.
//
// Nothing here knows what any particular kind of object means. Metadata is reported as the object
// carries it, under the key names the shared enum gives, so a kind of object invented later is
// described by this without it being touched — and a caller that wants a door's destination reads
// the same field the door itself was written with, rather than one this file paraphrased.
//
// Being read-only is also what makes the gate below hygiene rather than a security boundary: the
// most an installed bridge can disclose is where the page has already drawn things for whoever is
// looking at it.
//------------------------------------------------------------------------

const objectWorldTemp = new THREE.Vector3();
const cameraWorldTemp = new THREE.Vector3();
const projectionTemp = new THREE.Vector3();

// Metadata keys the other way round, so a value can be reported under the name it is known by
// rather than the number it is stored under.
const metadataNameByKey: {[key: number]: string} = {};
for (const [name, key] of Object.entries(ObjectMetadataKeyEnumMap))
    metadataNameByKey[key] = name;

// Where a world point falls on the page, in the viewport coordinates a pointer event carries — so
// what comes out of here can be handed straight to whatever dispatches the gesture. Null where the
// point is behind the camera, which has no answer in screen coordinates at all.
function toScreen(worldPosition: THREE.Vector3): {x: number, y: number} | null
{
    projectionTemp.copy(worldPosition).project(GraphicsManager.getCamera());
    // Behind the camera, or standing exactly at it — which the projection answers with infinities
    // rather than with a pixel, and which happens in the ordinary course of things: the camera
    // orbits whatever is selected, and can be wound right in to it.
    if (projectionTemp.z > 1 || !Number.isFinite(projectionTemp.x) || !Number.isFinite(projectionTemp.y))
        return null;

    const rect = GraphicsManager.getGameCanvas().getBoundingClientRect();
    return {
        x: rect.left + ((projectionTemp.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - projectionTemp.y) / 2) * rect.height,
    };
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
        screen,
        // Whether the pointer could actually get to that pixel, which the cast alone cannot say.
        ...(screen == null ? {overCanvas: false, coveredBy: "(behind the camera)"}
            : whatIsOnTopAt(screen.x, screen.y)),
        inFieldOfView: CameraUtil.pointIsInFieldOfView(objectWorldTemp),
        inLineOfSight: CameraUtil.objectIsInLineOfSight(objectWorldTemp, gameObject),
        distance,
        // A click on something out of reach is read as a click on nothing, so this is the difference
        // between an aim that will do something and one that will silently do nothing.
        withinSelectRange: distance <= WorldSpaceSelectionUtil.getMaxSelectDist(),
        metadata: readMetadata(gameObject),
    };
}

// What a click at this pixel would meet, decided by the same cast the click itself makes. Null
// where the ray met nothing at all.
//
// getNDC reads only the two coordinates, so a bare pair stands in for the event rather than a
// synthetic one being dispatched at the canvas — which would be an interaction, and this module
// performs none.
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
        // Empty where the geometry belongs to no object, which is a gizmo drawn over the room
        // rather than a thing standing in it.
        objectId: gameObject?.params.objectId ?? "",
        objectType: gameObject == undefined ? "" : getObjectType(gameObject),
        instanceId: intersection.instanceId ?? -1,
        world: {x: intersection.point.x, y: intersection.point.y, z: intersection.point.z},
        distance,
        withinSelectRange: distance <= WorldSpaceSelectionUtil.getMaxSelectDist(),
        ...whatIsOnTopAt(clientX, clientY),
    };
}

// A cast is answered by the scene alone, and the scene is not the whole page: the HUD, a popup, a
// speech bubble and a world-space button are all drawn over the canvas and all take the pointer
// first. So a pixel the cast happily reports a wall behind may be one where a real click lands on a
// button instead — the ray passes through what the pointer cannot.
//
// Which makes this the other half of the same question, and the reason it is asked here rather than
// left to the caller: the two answers only mean something together.
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
    // Installed only where this deployment is not the site the outside world is meant to reach,
    // which is the condition the server applies to everything else it withholds from the public
    // build (see IS_PUBLIC_SITE).
    install: (env: ThingsPoolEnv): void =>
    {
        if (env.mode != "dev" && env.serverType != "Staging")
            return;

        (window as any).__thingspool_automation = {
            // Whether there is yet anything to aim at. A caller polls this rather than sleeping,
            // since how long a room takes to arrive depends on the room.
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

            // Who is playing, where they are standing, and what the app currently lets them do.
            // The permissions are reported rather than left to be inferred from the user's type,
            // because they are what the controls themselves test — and they depend on the room as
            // much as on the person.
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
                        restrictedZones: room.voxelGrid.restrictedZones.map(zone => ({
                            rowMin: zone.rowMin, rowMax: zone.rowMax,
                            colMin: zone.colMin, colMax: zone.colMax,
                        })),
                    },
                    gameMode: gameModeObservable.peek(),
                    isAdmin: user != undefined && RoomValidationUtil.userIsAdmin(user),
                    canEditRoom: user != undefined && room != undefined &&
                        RoomValidationUtil.canUserEditRoom(user, room),
                    canManageDoors: user != undefined && room != undefined &&
                        RoomValidationUtil.canUserManageDoors(user, room),
                    isRoomSuperuser: user != undefined && room != undefined &&
                        RoomValidationUtil.isRoomSuperuser(user, room),
                };
            },

            // Everything the room holds, each with the pixel to aim at and whether aiming there
            // would reach it. `objectType` narrows it to one kind.
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

            // What a click at one pixel would meet. This is what turns "the click did nothing" into
            // an answer: the pixel was over the wrong thing, over nothing, or over the right thing
            // but out of reach.
            probe: (clientX: number, clientY: number) => probeAt(clientX, clientY),

            // The same question asked across the whole view at once, which is how a caller finds
            // somewhere to aim when it has no particular thing in mind — a patch of wall to hang
            // something on, a block to build against, a surface to stand a shot in front of. One
            // round trip rather than one per pixel, since the cast is cheap and the crossing is not.
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

            // What the app currently holds selected, which is how a caller confirms that the gesture
            // it made landed — the HUD it drives next is raised by this and nothing else.
            selection: () =>
            {
                const objectSelection = objectSelectionObservable.peek();
                const quadSelection = voxelQuadSelectionObservable.peek();
                const playerSelection = playerSelectionObservable.peek();
                return {
                    object: objectSelection == null ? null
                        : describeObject(objectSelection.gameObject),
                    voxelQuad: quadSelection == null ? null : {
                        col: quadSelection.voxel.col,
                        row: quadSelection.voxel.row,
                        quadIndex: quadSelection.quadIndex,
                    },
                    // The third kind, and the one edit mode opens on from a standing start. Reported
                    // alongside the other two because only one thing is ever selected, so a caller
                    // that cannot see this one cannot tell "nothing is picked out" from "the
                    // character is".
                    player: playerSelection == null ? null
                        : describeObject(playerSelection.gameObject),
                };
            },

            // Where the eye is and how far it may reach. A caller that finds its target out of range
            // reads the reach from here rather than assuming a number that has since changed, and a
            // caller framing a shot reads the canvas rect it is composing within.
            camera: () =>
            {
                const camera = GraphicsManager.getCamera();
                camera.getWorldPosition(cameraWorldTemp);
                const rect = GraphicsManager.getGameCanvas().getBoundingClientRect();
                return {
                    world: {x: cameraWorldTemp.x, y: cameraWorldTemp.y, z: cameraWorldTemp.z},
                    fov: camera.fov,
                    maxSelectDistance: WorldSpaceSelectionUtil.getMaxSelectDist(),
                    canvas: {left: rect.left, top: rect.top, width: rect.width, height: rect.height},
                };
            },
        };
    },
}

export default AutomationBridgeUtil;
