import * as THREE from "three";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import App from "../../app";
import ClientObjectManager from "../../object/clientObjectManager";
import ClientVoxelManager from "../../voxel/clientVoxelManager";
import CompositionMetadataUtil from "../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import DoorCompositionConstants from "../../../shared/graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import CanvasCompositionConstants from "../../../shared/graphics/mesh/composition/types/compositionConstants/canvasCompositionConstants";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import FreeCameraPose from "../../object/components/helpers/player/freeCameraPose";
import GameObject from "../../object/types/gameObject";
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import ObjectFactory from "../../object/factories/objectFactory";
import ObjectIdUtil from "../../../shared/object/util/objectIdUtil";
import ObjectMetadataEntryMap from "../../../shared/object/maps/objectMetadataEntryMap";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import RestrictedZone from "../../../shared/voxel/types/restrictedZone";
import RoomPaletteMap from "../../../shared/room/generation/maps/roomPaletteMap";
import ObjectAttachmentUtil from "../../../shared/object/util/objectAttachmentUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import Vec3 from "../../../shared/math/types/vec3";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import DoorObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import CanvasObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import { PLAYER_HEIGHT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN,
    FOG_COLOR_PALETTE_NAME, LIGHT_COLOR_PALETTE_NAME, MAX_RESTRICTED_ZONES, MAX_ROOM_Y,
    NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER, NUM_VOXEL_ROWS,
    SANDBOX_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import RoomLightingUtil from "../../graphics/light/util/roomLightingUtil";
import RoomPrefs from "../../../shared/room/types/roomPrefs";
import RoomPrefsUtil, { MAX_ROOM_PREFS_STEP } from "../../../shared/room/util/roomPrefsUtil";
import { ColorPaletteMap } from "../../../shared/math/maps/colorPaletteMap";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import ThingsPoolEnv from "../types/thingsPoolEnv";
import { cameraModeObservable, orbitCameraAnglesObservable, orbitCameraTargetOverrideObservable,
    orbitCameraViewRequestObservable, orbitCameraZoomObservable } from "../clientObservables";

// Automation surface (window.__thingspool_setup) that arranges the scene (player position, facing,
// orbit view) for playtests and screenshots, so runs don't pay for slow, imprecise locomotion. It never
// clicks, selects or edits; those remain real gestures (see AutomationBridgeUtil). Kept separate from
// the read-only bridge so the arrange/act line stays visible.
// - `look` targets the orbit camera, which only exists in edit mode.
// - In multiplayer rooms the server sweeps the move through collision from its own position, so
//   `place` is exact only on this client. Never assert server positions after it.
// The `sandbox` group also builds, but only inside the sandbox single-player room (checked on every
// call), where quick local playtests stand up what they need (see dev/scripts/playtest/sandboxRunner.js).

// Player height in collision layers (headroom required to stand).
const DOOR_FOOTPRINT_HEIGHT =
    DoorObjectTypeConfig.components.spawnedByAny.collider.baseHitboxSize.sizeY;
const PLAYER_LAYER_COUNT = Math.ceil(PLAYER_HEIGHT / COLLISION_LAYER_HEIGHT);

// Default cap on reported spots (nearest first).
const DEFAULT_SPOT_LIMIT = 40;

const directionTemp = new THREE.Vector3();

function requireRoom()
{
    const room = App.getCurrentRoom();
    if (room == undefined)
        throw new Error("No room has arrived yet (poll __thingspool_automation.ready() first).");
    return room;
}

function requireMyPlayer()
{
    const player = ClientObjectManager.getMyPlayer();
    if (player == undefined)
        throw new Error("The player has not spawned yet (poll __thingspool_automation.ready() first).");
    return player;
}

// Player origin height when standing at the bottom of a layer (same math as the single-player spawn;
// see ClientObjectUtil).
function standingHeight(collisionLayer: number): number
{
    return 0.5 * PLAYER_HEIGHT + (collisionLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
}

// Headroom from this layer up, plus support (room floor or a block).
function canStandAt(voxel: Voxel, collisionLayer: number): boolean
{
    if (collisionLayer < COLLISION_LAYER_MIN || collisionLayer + PLAYER_LAYER_COUNT - 1 > COLLISION_LAYER_MAX)
        return false;
    if (collisionLayer > COLLISION_LAYER_MIN &&
        !VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, collisionLayer - 1))
        return false;

    for (let layer = collisionLayer; layer < collisionLayer + PLAYER_LAYER_COUNT; ++layer)
    {
        if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer))
            return false;
    }
    return true;
}

// Standable layers in a cell, lowest first (a cell can offer both storeys).
function standingLayersAt(voxel: Voxel): number[]
{
    const layers: number[] = [];
    for (let layer = COLLISION_LAYER_MIN; layer <= COLLISION_LAYER_MAX; ++layer)
    {
        if (canStandAt(voxel, layer))
            layers.push(layer);
    }
    return layers;
}

// Player facing (the negated transform direction, since players face -Z; see FORWARD_DIR). Read from
// the live object, not spawn params.
function facingOfPlayer(player: GameObject): {x: number, z: number}
{
    player.obj.getWorldDirection(directionTemp);
    const length = Math.hypot(directionTemp.x, directionTemp.z);
    if (length < 1e-6)
        return {x: 0, z: 1};
    return {x: -directionTemp.x / length, z: -directionTemp.z / length};
}

function dirOfPlayer(player: GameObject): Vec3
{
    player.obj.getWorldDirection(directionTemp);
    return {x: directionTemp.x, y: directionTemp.y, z: directionTemp.z};
}

function dirFromFacing(facingX: number, facingZ: number): Vec3
{
    const length = Math.hypot(facingX, facingZ);
    if (length < 1e-6)
        return {x: 0, y: 0, z: -1};
    return {x: -facingX / length, y: 0, z: -facingZ / length};
}

// Degrees clockwise from +Z (same convention as bearings below).
const headingDegOf = (facing: {x: number, z: number}): number =>
    Math.atan2(facing.x, facing.z) * 180 / Math.PI;

function describePose()
{
    const player = requireMyPlayer();
    const position = player.position;
    const facing = facingOfPlayer(player);
    return {
        roomID: App.getCurrentRoom()?.id ?? "",
        x: position.x, y: position.y, z: position.z,
        row: VoxelQueryUtil.getVoxelRowFromWorldZ(position.z),
        col: VoxelQueryUtil.getVoxelColFromWorldX(position.x),
        collisionLayer: VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(position.y - 0.5 * PLAYER_HEIGHT),
        facing,
        headingDeg: headingDegOf(facing),
    };
}

// Places the player (unswept, no permission validation), keeping the facing unless given.
function placePlayer(position: Vec3, facingX?: number, facingZ?: number)
{
    const player = requireMyPlayer();
    const dir = (facingX == undefined || facingZ == undefined)
        ? dirOfPlayer(player) : dirFromFacing(facingX, facingZ);
    ClientObjectManager.setObjectTransform(player.params.objectId,
        new ObjectTransform(position, dir, player.params.transform.scale), true, false);
    return describePose();
}

// Build calls are allowed only in the sandbox room; elsewhere they'd fake evidence that bypasses gestures.
function requireSandboxRoom(what: string)
{
    const room = requireRoom();
    if (room.roomType != RoomTypeEnumMap.SinglePlayer || room.roomName != SANDBOX_SINGLE_PLAYER_MODE)
    {
        throw new Error(`${what} only works in the sandbox room; this is "${room.roomName}". Open ` +
            `the game with ?sandboxuser=<name> (or ?sandboxadmin=<name>) to get a sandbox, or in a ` +
            `room like this one stand the player somewhere with place() and build through the editing ` +
            `gestures.`);
    }
    return room;
}

// One texture on all six faces of a block layer (see NUM_VOXEL_QUADS_PER_COLLISION_LAYER).
const uniformFaces = (textureIndex: number) =>
    new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(textureIndex);

// Region bounds from a corner and size, clamped to the room (off-grid cells would silently no-op).
function regionOf(region: {row: number, col: number, collisionLayer: number,
    rows?: number, cols?: number, layers?: number})
{
    const rowStart = Math.max(0, Math.min(NUM_VOXEL_ROWS - 1, Math.floor(region.row)));
    const colStart = Math.max(0, Math.min(NUM_VOXEL_COLS - 1, Math.floor(region.col)));
    const layerStart = Math.max(COLLISION_LAYER_MIN,
        Math.min(COLLISION_LAYER_MAX, Math.floor(region.collisionLayer)));

    const numRows = Math.max(1, Math.floor(region.rows ?? 1));
    const numCols = Math.max(1, Math.floor(region.cols ?? 1));
    const numLayers = Math.max(1, Math.floor(region.layers ?? 1));

    return {
        rowStart, colStart, layerStart,
        numRows: Math.min(numRows, NUM_VOXEL_ROWS - rowStart),
        numCols: Math.min(numCols, NUM_VOXEL_COLS - colStart),
        layerEnd: Math.min(COLLISION_LAYER_MAX, layerStart + numLayers - 1),
    };
}

// Faces of a cell's block, as axis + orientation: the compass sides, its top (+y) and its bottom (-y).
const QUAD_FACES: {[face: string]: {axis: "x" | "y" | "z", orientation: "-" | "+"}} = {
    "-x": {axis: "x", orientation: "-"},
    "+x": {axis: "x", orientation: "+"},
    "-y": {axis: "y", orientation: "-"},
    "+y": {axis: "y", orientation: "+"},
    "-z": {axis: "z", orientation: "-"},
    "+z": {axis: "z", orientation: "+"},
};

// Attachment position and facing on a cell face, from the grid's own math (matches click placement).
// ignoreVisibility, because sets are often dressed before the wall behind goes up. A top face below the
// lowest layer is the room's floor, and a bottom face above the highest is its ceiling.
function faceTransformOf(voxel: Voxel, face: string, collisionLayer: number)
{
    const side = QUAD_FACES[face];
    if (side == undefined)
    {
        throw new Error(`"${face}" is not a face of a cell. Use one of ` +
            `${Object.keys(QUAD_FACES).join(", ")} — the side of the cell the object is attached to.`);
    }

    const beyondLayers = collisionLayer < COLLISION_LAYER_MIN || collisionLayer > COLLISION_LAYER_MAX;
    const quadIndex = (side.axis == "y" && beyondLayers)
        ? ((side.orientation == "+")
            ? VoxelQueryUtil.getFloorVoxelQuadIndex(voxel.row, voxel.col)
            : VoxelQueryUtil.getCeilingVoxelQuadIndex(voxel.row, voxel.col))
        : VoxelQueryUtil.getVoxelQuadIndex(voxel.row, voxel.col, side.axis, side.orientation, collisionLayer);
    if (quadIndex < 0)
        throw new Error(`Cell [row ${voxel.row}, col ${voxel.col}] has no "${face}" face on layer ${collisionLayer}.`);

    const dimensions = VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, quadIndex, true);
    return {
        x: voxel.col + 0.5 + dimensions.offsetX,
        y: dimensions.offsetY,
        z: voxel.row + 0.5 + dimensions.offsetZ,
        dir: {x: dimensions.dirX, y: dimensions.dirY, z: dimensions.dirZ} as Vec3,
    };
}

// The floor a door on this face stands on: the lowest standable surface in the cell in front (e.g. a
// step), or undefined. Doors with no floor in front are refused.
function doorFloorY(voxels: Voxel[], row: number, col: number, face: string): number | undefined
{
    const side = QUAD_FACES[face];
    const inFront = VoxelQueryUtil.getVoxel(voxels,
        row + (side.axis == "z" ? (side.orientation == "+" ? 1 : -1) : 0),
        col + (side.axis == "x" ? (side.orientation == "+" ? 1 : -1) : 0));
    if (inFront == undefined)
        return undefined;

    // Lowest surface with a full doorway of headroom.
    for (const layer of standingLayersAt(inFront))
    {
        const floorY = (layer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
        if (floorY + DOOR_FOOTPRINT_HEIGHT <= MAX_ROOM_Y)
            return floorY;
    }
    return undefined;
}

// Blocks covering any part of an attachment's face, one block out from it. Stricter than the game's rule
// (partly clear is fine for building, bad for a photo). Returns the blockers so the caller can move.
function blockersInFrontOf(voxels: Voxel[], colliderState: {hitbox: {center: Vec3, halfSize: Vec3}},
    dir: Vec3): {row: number, col: number, layer: number}[]
{
    const {center, halfSize} = colliderState.hitbox;
    const {normal} = Geometry3DUtil.getAxisFacingBasis(dir);
    // Along the facing, the block just in front; across it, every block the face spans.
    const range = (toIndex: (v: number) => number, axis: "x" | "y" | "z") => (normal[axis] != 0)
        ? {first: toIndex(center[axis] + 0.01 * normal[axis]), last: toIndex(center[axis] + 0.01 * normal[axis])}
        : {first: toIndex(center[axis] - halfSize[axis] + 0.01), last: toIndex(center[axis] + halfSize[axis] - 0.01)};
    const cols = range(VoxelQueryUtil.getVoxelColFromWorldX, "x");
    const layers = range(VoxelQueryUtil.getVoxelCollisionLayerFromWorldY, "y");
    const rows = range(VoxelQueryUtil.getVoxelRowFromWorldZ, "z");

    const blockers: {row: number, col: number, layer: number}[] = [];
    for (let row = rows.first; row <= rows.last; ++row)
    {
        for (let col = cols.first; col <= cols.last; ++col)
        {
            const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
            if (voxel == undefined)
                continue;
            for (let layer = Math.max(COLLISION_LAYER_MIN, layers.first);
                layer <= Math.min(COLLISION_LAYER_MAX, layers.last); ++layer)
            {
                if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer))
                    blockers.push({row, col, layer});
            }
        }
    }
    return blockers;
}

// Metadata by the game's key names (e.g. `{Label: "Library"}`), preprocessed like user input.
function metadataFrom(entries: {[key: string]: string} | undefined): ObjectMetadata
{
    const metadata: ObjectMetadata = {};
    for (const [name, value] of Object.entries(entries ?? {}))
    {
        const key = ObjectMetadataKeyEnumMap[name];
        if (key == undefined)
        {
            throw new Error(`"${name}" is not a piece of object metadata. The keys are ` +
                `${Object.keys(ObjectMetadataKeyEnumMap).join(", ")}.`);
        }
        metadata[key] = new EncodableByteString(
            ObjectMetadataEntryMap.preprocess(key, String(value)));
    }
    return metadata;
}

const AutomationSetupUtil =
{
    // Same gate as the read-only bridge (non-public deployments). It only changes this client's view.
    install: (env: ThingsPoolEnv): void =>
    {
        if (env.mode != "dev" && env.serverType != "Staging")
            return;

        (window as any).__thingspool_setup = {
            // Player position and facing.
            pose: () => describePose(),

            // Standable spots, nearest first, read from the room grid. The same cell can appear on
            // both storeys; collisionLayer distinguishes them.
            standingSpots: (options?: {near?: {x: number, z: number}, collisionLayer?: number,
                limit?: number}) =>
            {
                const room = requireRoom();
                const near = options?.near ?? describePose();
                const limit = options?.limit ?? DEFAULT_SPOT_LIMIT;

                const spots: Record<string, unknown>[] = [];
                for (let row = 0; row < NUM_VOXEL_ROWS; ++row)
                {
                    for (let col = 0; col < NUM_VOXEL_COLS; ++col)
                    {
                        const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
                        if (voxel == undefined)
                            continue;
                        for (const layer of standingLayersAt(voxel))
                        {
                            if (options?.collisionLayer != undefined && layer != options.collisionLayer)
                                continue;
                            const x = col + 0.5;
                            const z = row + 0.5;
                            spots.push({
                                x, z, row, col,
                                collisionLayer: layer,
                                y: standingHeight(layer),
                                distance: Math.hypot(x - near.x, z - near.z),
                            });
                        }
                    }
                }
                spots.sort((a, b) => (a.distance as number) - (b.distance as number));
                return spots.slice(0, limit);
            },

            // Places the player at a cell's standing height. Without collisionLayer, uses the layer
            // nearest the current one, so moves stay on the same storey.
            place: (x: number, z: number, options?: {collisionLayer?: number,
                faceX?: number, faceZ?: number}) =>
            {
                const room = requireRoom();
                const row = VoxelQueryUtil.getVoxelRowFromWorldZ(z);
                const col = VoxelQueryUtil.getVoxelColFromWorldX(x);
                const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, row, col);
                if (voxel == undefined)
                    throw new Error(`(${x}, ${z}) is outside the room.`);

                const layers = standingLayersAt(voxel);
                if (layers.length == 0)
                    throw new Error(`Nothing can stand at (${x}, ${z}) — cell [row ${row}, col ${col}] ` +
                        `is solid or has no headroom. Ask standingSpots({near: {x, z}}) for the nearest place that is not.`);

                let collisionLayer = options?.collisionLayer;
                if (collisionLayer == undefined)
                {
                    const current = describePose().collisionLayer;
                    collisionLayer = layers.reduce((best, layer) =>
                        Math.abs(layer - current) < Math.abs(best - current) ? layer : best, layers[0]);
                }
                else if (!layers.includes(collisionLayer))
                {
                    throw new Error(`Nothing can stand at (${x}, ${z}) on layer ${collisionLayer}. ` +
                        `That cell offers ${layers.join(", ") || "no layer at all"}.`);
                }

                return placePlayer({x, y: standingHeight(collisionLayer), z},
                    options?.faceX, options?.faceZ);
            },

            // Turns the player to face a point, without moving him.
            face: (x: number, z: number) =>
            {
                const pose = describePose();
                return placePlayer({x: pose.x, y: pose.y, z: pose.z}, x - pose.x, z - pose.z);
            },

            // The same turn given as an absolute heading, in degrees clockwise from +Z.
            faceDeg: (headingDeg: number) =>
            {
                const pose = describePose();
                const radians = headingDeg * Math.PI / 180;
                return placePlayer({x: pose.x, y: pose.y, z: pose.z},
                    Math.sin(radians), Math.cos(radians));
            },

            // Requests an orbit view (angles, zoom 0 far .. 1 near). A request survives re-framing
            // (see orbitCameraViewRequestObservable); in play mode it applies on entering edit mode.
            look: (view: {azimuthDeg?: number, polarDeg?: number, zoom?: number}) =>
            {
                const current = orbitCameraAnglesObservable.peek();
                const azimuth = view.azimuthDeg == undefined
                    ? current.azimuth : view.azimuthDeg * Math.PI / 180;
                const polar = view.polarDeg == undefined
                    ? current.polar : view.polarDeg * Math.PI / 180;
                const zoomAmount = view.zoom == undefined ? orbitCameraZoomObservable.peek() : view.zoom;
                orbitCameraViewRequestObservable.set({azimuth, polar, zoomAmount});
                // Degrees, matching the input.
                return {azimuthDeg: azimuth * 180 / Math.PI, polarDeg: polar * 180 / Math.PI,
                    zoom: zoomAmount};
            },

            // Current orbit view, for swinging relative to it.
            view: () =>
            {
                const angles = orbitCameraAnglesObservable.peek();
                return {
                    azimuthDeg: angles.azimuth * 180 / Math.PI,
                    polarDeg: angles.polar * 180 / Math.PI,
                    zoom: orbitCameraZoomObservable.peek(),
                };
            },

            // Holds the orbit on a point instead of the selection (release with clearLookAt).
            lookAt: (x: number, y: number, z: number) =>
            {
                orbitCameraTargetOverrideObservable.set({x, y, z});
                return {x, y, z};
            },

            clearLookAt: () =>
            {
                orbitCameraTargetOverrideObservable.set(null);
                return null;
            },

            // Sandbox: an empty single-player room (?sandboxuser=<name> or ?sandboxadmin=<name>) with a
            // free camera, where a local playtest builds what it tests by calls.
            sandbox: {
                active: () =>
                {
                    const room = App.getCurrentRoom();
                    return room != undefined &&
                        room.roomType == RoomTypeEnumMap.SinglePlayer &&
                        room.roomName == SANDBOX_SINGLE_PLAYER_MODE;
                },

                // Sets the free camera position and/or target in world coordinates (either alone).
                camera: (view: {x?: number, y?: number, z?: number,
                    atX?: number, atY?: number, atZ?: number}) =>
                {
                    requireSandboxRoom("Aiming the free camera");
                    const pose = FreeCameraPose.getPose();

                    if (view.x != undefined || view.y != undefined || view.z != undefined)
                    {
                        FreeCameraPose.moveTo(view.x ?? pose.position.x, view.y ?? pose.position.y,
                            view.z ?? pose.position.z);
                    }
                    if (view.atX != undefined || view.atY != undefined || view.atZ != undefined)
                    {
                        FreeCameraPose.lookAt(view.atX ?? pose.target.x, view.atY ?? pose.target.y,
                            view.atZ ?? pose.target.z);
                    }
                    return AutomationSetupUtil.describeFreeCamera();
                },

                // Where the free camera is now, for a script composing off the view it already has.
                cameraPose: () =>
                {
                    requireSandboxRoom("Reading the free camera");
                    return AutomationSetupUtil.describeFreeCamera();
                },

                // Adds a box of blocks in one texture (corner cell + size). No permission validation.
                addBlocks: (region: {row: number, col: number, collisionLayer: number,
                    rows?: number, cols?: number, layers?: number, textureIndex?: number}) =>
                {
                    const room = requireSandboxRoom("Standing blocks up");
                    const box = regionOf(region);
                    ClientVoxelManager.addVoxelBlocksByChunk(room, box.rowStart, box.colStart,
                        box.numRows, box.numCols, box.layerStart, box.layerEnd,
                        uniformFaces(region.textureIndex ?? 0), false);
                    return box;
                },

                // Takes the same kind of box away again.
                removeBlocks: (region: {row: number, col: number, collisionLayer: number,
                    rows?: number, cols?: number, layers?: number}) =>
                {
                    const room = requireSandboxRoom("Taking blocks away");
                    const box = regionOf(region);
                    ClientVoxelManager.removeVoxelBlocksByChunk(room, box.rowStart, box.colStart,
                        box.numRows, box.numCols, box.layerStart, box.layerEnd, false);
                    return box;
                },

                // Sets the texture pack (re-dresses existing blocks); with no argument, reports options.
                texturePack: async (texturePackPath?: string) =>
                {
                    const room = requireSandboxRoom("Choosing the texture pack");
                    if (texturePackPath != undefined)
                    {
                        const packs = RoomPaletteMap.getTexturePackPaths();
                        if (!packs.includes(texturePackPath))
                        {
                            throw new Error(`"${texturePackPath}" is not a texture pack. ` +
                                `The packs are ${packs.join(", ")}.`);
                        }
                        room.texturePackPath = texturePackPath;
                        await ClientVoxelManager.applyVoxelTexturePack(texturePackPath);
                    }
                    return {
                        texturePackPath: room.texturePackPath,
                        texturePackPaths: RoomPaletteMap.getTexturePackPaths(),
                    };
                },

                // Sets lighting by RoomPrefs field; with no argument, reports current values.
                roomLighting: async (prefs?: Partial<RoomPrefs>) =>
                {
                    const room = requireSandboxRoom("Lighting the room");
                    if (prefs != undefined)
                    {
                        // Applied like a loaded room's lighting (no server, nothing to race; see
                        // RoomLightingUtil).
                        RoomLightingUtil.applyRoomLighting(RoomPrefsUtil.encode(
                            {...RoomPrefsUtil.decode(room.prefs), ...prefs}));
                    }
                    return {
                        ...RoomPrefsUtil.decode(room.prefs),
                        maxStep: MAX_ROOM_PREFS_STEP,
                        lightColors: ColorPaletteMap[LIGHT_COLOR_PALETTE_NAME],
                        fogColors: ColorPaletteMap[FOG_COLOR_PALETTE_NAME],
                    };
                },

                // Curated palettes per pack (see RoomPaletteMap), so sets look game-built.
                palettes: (texturePackPath?: string) =>
                {
                    const room = requireSandboxRoom("Reading the palettes");
                    const path = texturePackPath ?? room.texturePackPath;
                    return RoomPaletteMap.getPalettes(path).map(palette => ({
                        texturePackPath: path,
                        floor: palette.floor, ceiling: palette.ceiling,
                        wall: palette.wall, prop: palette.prop,
                    }));
                },

                // Available canvas pictures with authors.
                pictures: () =>
                {
                    requireSandboxRoom("Listing the pictures");
                    return ImageMapUtil.getImageMap("CanvasImageMap").getImageMetadataList()
                        .map(image => ({path: image.path, title: image.title, author: image.author}));
                },

                // Door finishes as ready-to-spread metadata. Explicit, because seeded random finishes
                // often repeat across neighbouring doors. Same set as the customization form.
                doorStyles: () =>
                {
                    requireSandboxRoom("Listing the door finishes");
                    return DoorCompositionConstants.presets.map(colors => ({
                        InstancedMeshComposition: CompositionMetadataUtil.encode(
                            InstancedMeshCompositionCodecTypeEnumMap.Door, 0, {colors}),
                    }));
                },

                // Canvas frame presets as ready-to-spread metadata. Explicit for the same reason as the
                // door finishes. Same set as the customization form.
                canvasFrameStyles: () =>
                {
                    requireSandboxRoom("Listing the canvas frame presets");
                    const composer = CanvasObjectTypeConfig.components.spawnedByAny.instancedMeshComposer;
                    // A preset is a finish only, so the frame is turned on here.
                    return CanvasCompositionConstants.presets.map(preset => ({
                        InstancedMeshComposition: CompositionMetadataUtil.encode(
                            composer.codecType, composer.codecVersion, {...preset, framed: true, margin: 0}),
                    }));
                },

                // Attaches a picture, door or lamp to a cell face (cell-addressed, like the walls). Spawned
                // through the normal factory with normal metadata; only the permission check is skipped.
                addObject: async (spec: {type: string, row: number, col: number,
                    collisionLayer?: number, face?: string, y?: number,
                    metadata?: {[key: string]: string}}) =>
                {
                    const room = requireSandboxRoom("Hanging an object");
                    const voxel = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, spec.row, spec.col);
                    if (voxel == undefined)
                        throw new Error(`Cell [row ${spec.row}, col ${spec.col}] is outside the room.`);

                    const objectTypeIndex = ObjectTypeConfigMap.getIndexByType(spec.type);
                    const collisionLayer = spec.collisionLayer ?? COLLISION_LAYER_MIN;
                    const face = spec.face ?? "-z";
                    const place = faceTransformOf(voxel, face, collisionLayer);

                    // Doors stand on the floor; origin is half a doorway up (collider-centred). `y` overrides.
                    const isDoor = spec.type == "Door";
                    let y = spec.y;
                    if (y == undefined && isDoor)
                    {
                        const floorY = doorFloorY(room.voxelGrid.voxels, spec.row, spec.col, face);
                        if (floorY == undefined)
                        {
                            throw new Error(`There is no floor in front of the "${face}" face of ` +
                                `cell [row ${spec.row}, col ${spec.col}] for a door to stand on — ` +
                                `the cell there is solid, or has no headroom. A door's bottom edge ` +
                                `meets the line where the wall meets the floor, so it needs one.`);
                        }
                        y = floorY + 0.5 * DOOR_FOOTPRINT_HEIGHT;
                    }
                    if (y == undefined)
                        y = place.y;

                    const user = App.getUser();
                    const objectId = ObjectIdUtil.generateRandomObjectId();
                    const pos = {x: place.x, y, z: place.z};
                    const transform = new ObjectTransform(pos, place.dir,
                        ObjectScaleUtil.getDefaultScale(objectTypeIndex));

                    // The stricter photo check first, since it gives the more specific error.
                    const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
                        objectTypeIndex, transform);
                    const blockers = colliderState == undefined ? []
                        : blockersInFrontOf(room.voxelGrid.voxels, colliderState, place.dir);
                    if (blockers.length > 0)
                    {
                        throw new Error(`A ${spec.type} on the "${face}" face of cell ` +
                            `[row ${spec.row}, col ${spec.col}] would be hidden behind the block ` +
                            `work at ` +
                            `${blockers.map(b => `[row ${b.row}, col ${b.col}, layer ${b.layer}]`).join(", ")}. ` +
                            `Move it along its face, or take that block work away.`);
                    }

                    // The game's placement rule still applies (catches mid-air and overlapping
                    // attachments, and faces the type may not be attached to).
                    if (!ObjectAttachmentUtil.canPlaceObject(room, objectId, objectTypeIndex,
                        transform))
                    {
                        throw new Error(`Nothing will hold a ${spec.type} on the "${face}" face of ` +
                            `cell [row ${spec.row}, col ${spec.col}] at y ${y}. Either the type can't ` +
                            `face that way, or nothing is standing in that cell across the object's ` +
                            `size — name the supporting block's own cell, not the one in front of ` +
                            `it — or something is already attached there.`);
                    }

                    const signal = new AddObjectSignal(room.id, user.id, user.userName,
                        objectTypeIndex, objectId, transform, metadataFrom(spec.metadata));

                    const gameObject = ObjectFactory.createServerSideObject(signal);
                    if (!await ClientObjectManager.addObject(gameObject, false))
                        throw new Error(`The room would not take a ${spec.type} there.`);

                    return {objectId, type: spec.type, x: place.x, y, z: place.z, dir: place.dir};
                },

                // Resizes an object in place, in multiples of its type's step. The game's own rule is
                // applied, so an object with no room to grow into keeps the size it had.
                resizeObject: (spec: {objectId: string, x?: number, y?: number, z?: number}) =>
                {
                    const room = requireSandboxRoom("Resizing an object");
                    const obj = room.objectById[spec.objectId];
                    if (obj == undefined)
                        throw new Error(`No object "${spec.objectId}" is standing in the room.`);

                    const scale = obj.transform.scale;
                    const transform = new ObjectTransform({...obj.transform.pos}, {...obj.transform.dir},
                        {x: spec.x ?? scale.x, y: spec.y ?? scale.y, z: spec.z ?? scale.z});
                    ClientObjectManager.setObjectTransform(spec.objectId, transform, true);

                    const applied = room.objectById[spec.objectId].transform.scale;
                    return {objectId: spec.objectId, scale: {...applied},
                        size: ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, applied)};
                },

                // Removes an object by id. Checked here because the removal skips its own validation and
                // would fail with an unhelpful error.
                removeObject: async (objectId: string) =>
                {
                    const room = requireSandboxRoom("Taking an object down");
                    if (room.objectById[objectId] == undefined)
                        throw new Error(`No object "${objectId}" is standing in the room.`);
                    await ClientObjectManager.removeObject(objectId, false);
                    return {objectId};
                },

                // Replaces the room's restricted zones (row/col rectangles; see
                // @docs/gameplay/restricted_zone.md); with no argument, reports them. Outlines render
                // only in edit mode. The game's permission rule is applied (it passes in single-player
                // rooms) and catches invalid rectangles.
                restrictedZones: (zones?: {rowMin: number, rowMax: number,
                    colMin: number, colMax: number}[]) =>
                {
                    const room = requireSandboxRoom("Laying restricted zones");
                    if (zones != undefined)
                    {
                        const laid = zones.map(zone => new RestrictedZone(
                            zone.rowMin, zone.rowMax, zone.colMin, zone.colMax));
                        if (!ClientVoxelManager.setRestrictedZones(room, laid))
                        {
                            throw new Error(`The room will not take those zones. Each one is whole ` +
                                `cells of the grid — rows 0 to ${NUM_VOXEL_ROWS - 1}, columns 0 to ` +
                                `${NUM_VOXEL_COLS - 1} — with each minimum no greater than its ` +
                                `maximum, and a room holds at most ${MAX_RESTRICTED_ZONES} of them.`);
                        }
                    }
                    return room.voxelGrid.restrictedZones.map(zone => ({
                        rowMin: zone.rowMin, rowMax: zone.rowMax,
                        colMin: zone.colMin, colMax: zone.colMax,
                    }));
                },

                // Resets the set to the generated floor. The player stays (the camera hangs off it).
                clear: async () =>
                {
                    const room = requireSandboxRoom("Clearing the set");
                    ClientVoxelManager.removeVoxelBlocksByChunk(room, 0, 0,
                        NUM_VOXEL_ROWS, NUM_VOXEL_COLS,
                        COLLISION_LAYER_MIN, COLLISION_LAYER_MAX, false);

                    const playerTypeIndex = ObjectTypeConfigMap.getIndexByType("Player");
                    for (const object of Object.values(room.objectById))
                    {
                        if (object.objectTypeIndex != playerTypeIndex)
                            await ClientObjectManager.removeObject(object.objectId, false);
                    }

                    // Stale zones would outline the next set.
                    ClientVoxelManager.setRestrictedZones(room, []);

                    FreeCameraPose.reset();
                    return AutomationSetupUtil.describeFreeCamera();
                },
            },
        };
    },

    // Free camera position, target and the implied direction.
    describeFreeCamera: () =>
    {
        const pose = FreeCameraPose.getPose();
        const forward = pose.target.clone().sub(pose.position);
        const distance = forward.length();
        if (distance > 1e-6)
            forward.divideScalar(distance);
        return {
            x: pose.position.x, y: pose.position.y, z: pose.position.z,
            atX: pose.target.x, atY: pose.target.y, atZ: pose.target.z,
            distance,
            forward: {x: forward.x, y: forward.y, z: forward.z},
            cameraMode: cameraModeObservable.peek().type,
        };
    },
}

export default AutomationSetupUtil;
