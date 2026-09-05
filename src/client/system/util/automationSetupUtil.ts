import * as THREE from "three";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import App from "../../app";
import ClientObjectManager from "../../object/clientObjectManager";
import ClientVoxelManager from "../../voxel/clientVoxelManager";
import CompositionMetadataUtil from "../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import DoorCompositionConstants from "../../../shared/graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
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
import WallAttachedObjectUtil from "../../../shared/object/util/wallAttachedObjectUtil";
import Vec3 from "../../../shared/math/types/vec3";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, DOOR_FOOTPRINT_HEIGHT,
    MAX_RESTRICTED_ZONES, MAX_ROOM_Y, NUM_VOXEL_COLS, NUM_VOXEL_QUADS_PER_COLLISION_LAYER,
    NUM_VOXEL_ROWS, PLAYER_HEIGHT, SANDBOX_SINGLE_PLAYER_MODE } from "../../../shared/system/sharedConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import ThingsPoolEnv from "../types/thingsPoolEnv";
import { cameraModeObservable, orbitCameraAnglesObservable, orbitCameraTargetOverrideObservable,
    orbitCameraViewRequestObservable, orbitCameraZoomObservable } from "../clientObservables";

//------------------------------------------------------------------------
// Puts the player and the camera where a scripted run needs them, for the same two callers the
// read-only bridge beside this serves: automated play, and the runs that capture screenshots.
//
// It exists because of what those runs actually spend their time on. Everything in a room is reached
// by going to it, and the controls that get you there are deliberately loose ones: the player covers
// about a pace in a few seconds, the view is swung by holding a pointer off-centre at a gain that
// varies more than tenfold between runs, and the orbit is measured in pixels of drag. So a script
// that wants a shot from the gallery above pays for it in a minute of walking that lands somewhere
// slightly different every time, and then aims its clicks from a view it can only guess at. That is
// a precondition being paid for at the price of the thing itself.
//
// The distinction this draws, and the whole of it, is between *arranging* a scene and *acting* in
// one. Standing in a particular spot is not what a capture or a playtest is testing; it is what has
// to be true before the test begins. So this sets it directly. What the run then does — every click,
// every selection, every edit — is left exactly where it was, as a real gesture on the canvas, which
// is what makes it run the same path a player's does: the tap arbitration, the raycast, the object's
// own handler, and the permission check inside that. Nothing here clicks, selects, or places
// anything, and it should stay that way: the moment arranging and acting are served by one surface,
// a passing test stops being evidence that the game works.
//
// Which is also why this is its own surface rather than an addition to AutomationBridgeUtil. That
// module argues for being read-only and is right about itself; the line between the two is easier to
// hold when it is visible in the name of the thing being called.
//
// Two things a caller has to know, because both cost a run to discover:
//
//   - `look` speaks to the orbit camera, which is edit mode's. In play mode the camera sits at the
//     player's eye and rides his object, so a view set here is not taken up until the mode is.
//   - In a multiplayer room the server keeps its own copy of where the player stands, and sweeps
//     every move it is told about through collision from *its* last known point. `place` is
//     therefore exact on this client — which is all a photograph is made of — while the server's
//     copy stops at the first wall on the way. Use it freely to compose a shot; use it in a playtest
//     to shorten a journey within a room, and never as the thing an assertion about a server-side
//     position rests on.
//
// The one place that line is drawn differently is the `sandbox` group at the bottom, which builds
// as well as arranges. It is allowed to because of where it is allowed: an empty single-player room
// generated to be a set and nothing else, with no other player in it and nothing in it under test.
// The room is checked for on every call rather than assumed, so the exception cannot leak into a
// room where a wall standing up would be evidence of something — a playtest is the caller this
// matters for, and no part of one happens in there.
//
// That group is a photographic studio rather than a shortcut around the game. Screenshots for a
// dev-log post are made in it, and a photograph has never been a claim that the room it was taken in
// arose by itself: what the reader is being shown is a material, a shape, a doorway, and the set it
// stands in is scenery in the sense a film set is. So the group is stocked for dressing one — walls
// and floors to build, a texture pack to finish them in, pictures and doors to hang on them, and a
// camera that goes anywhere and answers to nothing.
//------------------------------------------------------------------------

// How many collision layers the player's own height occupies, and so how much clear headroom a cell
// needs before he can stand in it.
const PLAYER_LAYER_COUNT = Math.ceil(PLAYER_HEIGHT / COLLISION_LAYER_HEIGHT);

// The most spots one call will report. A room is thousands of cell-and-layer pairs and a caller
// wants the few nearest somewhere, so the far ones are cut rather than crossing the bridge.
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

// Where the player's own origin sits when he is standing with his feet at the bottom of a layer.
// His transform names his middle, so this is the same arithmetic the single-player spawn position is
// derived with (see ClientObjectUtil).
function standingHeight(collisionLayer: number): number
{
    return 0.5 * PLAYER_HEIGHT + (collisionLayer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
}

// Whether a cell has room for the player from this layer up, and something under it to stand on.
// The room's own floor holds up the lowest layer; above that it takes a block.
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

// Every layer of one cell the player could stand at, lowest first. A cell can offer more than one:
// the ground floor and the storey above it are the same cell seen at two heights, which is why a
// caller asking for somewhere to stand has to be told the height along with the place.
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

// The way the player faces, which is not the direction his transform carries: he is drawn along his
// object's -Z (see FORWARD_DIR), so his facing is that direction negated. Everything a caller says
// about where he is looking is in these terms, and everything written back through `dir` is negated
// again on the way out.
//
// Read off the object itself rather than the parameters he spawned with, which are not written back
// as he moves and so describe where he came in rather than where he is.
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

// Degrees clockwise from +Z, which is the same convention a bearing between two points is read in
// below — so a caller can subtract one from the other and get a turn.
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

// Moves the player, keeping whatever way he is facing unless told otherwise. `ignorePhysics` is what
// makes this a placement rather than a very fast walk: the move is not swept, so it does not stop at
// the first thing between here and there. `validate` is off because there is no user action to check
// permission for — this is the harness arranging its own client.
function placePlayer(position: Vec3, facingX?: number, facingZ?: number)
{
    const player = requireMyPlayer();
    const dir = (facingX == undefined || facingZ == undefined)
        ? dirOfPlayer(player) : dirFromFacing(facingX, facingZ);
    ClientObjectManager.setObjectTransform(player.params.objectId, position, dir, true, false);
    return describePose();
}

// The sandbox is the one room where the block work may be stood up by calling rather than by
// building it: it is an empty single-player room nobody else is in, generated for no purpose but to
// be arranged, and nothing in it is the subject of a test. Everywhere else the same call would be a
// script asserting that a wall exists because it put one there without going through the gesture
// that puts walls up — which is the distinction this whole surface is drawn around, so it is
// enforced here rather than left as a rule to remember.
function requireSandboxRoom(what: string)
{
    const room = requireRoom();
    if (room.roomType != RoomTypeEnumMap.SinglePlayer || room.roomName != SANDBOX_SINGLE_PLAYER_MODE)
    {
        throw new Error(`${what} only works in the sandbox room; this is "${room.roomName}". Open ` +
            `the game with ?sandboxuser=<name> to get a sandbox, or in a room like this one stand ` +
            `the player somewhere with place() and build through the editing gestures.`);
    }
    return room;
}

// One collision layer of a block, finished in the same texture all over. The array names the six
// faces of the box in turn (see NUM_VOXEL_QUADS_PER_COLLISION_LAYER); a set being dressed wants them
// to read as one material rather than as a floor with walls on it, so one index covers all six.
const uniformFaces = (textureIndex: number) =>
    new Array<number>(NUM_VOXEL_QUADS_PER_COLLISION_LAYER).fill(textureIndex);

// The bounds of a box of cells, from a corner and a size, clamped to the room. Written once because
// every build call takes its region the same way, and a region that ran off the grid would
// otherwise be a silent no-op on the cells beyond the edge.
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

// Which side of a cell a wall attachment hangs on, in the terms a set is built in: the same four
// compass directions the blocks were stood up along. Read as an axis and a way along it, which is
// how the grid itself names the faces of a cell.
const QUAD_FACES: {[face: string]: {axis: "x" | "z", orientation: "-" | "+"}} = {
    "-x": {axis: "x", orientation: "-"},
    "+x": {axis: "x", orientation: "+"},
    "-z": {axis: "z", orientation: "-"},
    "+z": {axis: "z", orientation: "+"},
};

// Where on a cell's face something hung there would sit, and which way it would look.
//
// Taken from the grid's own arithmetic rather than worked out again here, so that a picture put up
// by asking hangs exactly where one put up by clicking would. `ignoreVisibility` because a face is
// a place whether or not there is anything drawn on it: a set is often dressed before the wall
// behind it goes up, and a quad hidden at the moment of asking reports a position far below the
// room rather than an error.
function faceTransformOf(voxel: Voxel, face: string, collisionLayer: number)
{
    const side = QUAD_FACES[face];
    if (side == undefined)
    {
        throw new Error(`"${face}" is not a face of a cell. Use one of ` +
            `${Object.keys(QUAD_FACES).join(", ")} — the side of the cell the object hangs on.`);
    }

    const quadIndex = VoxelQueryUtil.getVoxelQuadIndex(voxel.row, voxel.col, side.axis,
        side.orientation, collisionLayer);
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

// The floor a door hung on this face would stand on: the lowest surface in the cell in front of the
// wall that a person could actually stand on, or undefined if there is none.
//
// A door is not hung at a height at all. It stands on the floor, and its bottom edge meets the line
// where the wall meets that floor — half a cell out either way is the first thing an eye finds in a
// photograph of one. But the floor it stands on is not always the room's: a set with a step along
// its far wall puts its doors on the step, and that is a doorway rather than a mistake.
//
// What separates the step from the pillar standing in front of the wall is whether a person could
// stand on it and walk through, which is the same question asked of anywhere else in the room — so
// it is asked with the same function. A door with no floor in front of it is refused rather than
// stood on top of whatever is there.
function doorFloorY(voxels: Voxel[], row: number, col: number, face: string): number | undefined
{
    const side = QUAD_FACES[face];
    const inFront = VoxelQueryUtil.getVoxel(voxels,
        row + (side.axis == "z" ? (side.orientation == "+" ? 1 : -1) : 0),
        col + (side.axis == "x" ? (side.orientation == "+" ? 1 : -1) : 0));
    if (inFront == undefined)
        return undefined;

    // The lowest such surface, and it has to have a whole doorway of room above it: the top of a
    // pillar standing against the wall is somewhere a person can stand, but a door up there would
    // run out through the ceiling.
    for (const layer of standingLayersAt(inFront))
    {
        const floorY = (layer - COLLISION_LAYER_MIN) * COLLISION_LAYER_HEIGHT;
        if (floorY + DOOR_FOOTPRINT_HEIGHT <= MAX_ROOM_Y)
            return floorY;
    }
    return undefined;
}

// Whether anything stands in front of a wall attachment, over any part of its face.
//
// The game's own placement rule (see WallAttachedObjectUtil) asks only that the front be *partly*
// clear, which is the right rule for building: a picture half behind a pillar is a thing a room's
// owner is allowed to want. It is the wrong rule for a photograph, where a door with a pilaster
// across a third of it is simply a bad frame — and one that is easy to build by accident, since the
// block work goes up before the doors do and nothing in the finished set says which cell is in front
// of which.
//
// Reported as the blocking cells rather than as a refusal, so the caller can say where to move to.
function blockersInFrontOf(voxels: Voxel[], colliderState: {hitbox: {center: Vec3, halfSize: Vec3}},
    dir: Vec3): {row: number, col: number}[]
{
    const {center, halfSize} = colliderState.hitbox;
    const bottomLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(center.y - halfSize.y + 0.01);
    const topLayer = VoxelQueryUtil.getVoxelCollisionLayerFromWorldY(center.y + halfSize.y - 0.01);

    // The face runs along whichever horizontal axis the object does not point down, and the cells to
    // check are the ones one step along the way it looks.
    const alongZ = Math.abs(dir.z) >= Math.abs(dir.x);
    const frontRow = Math.floor(center.z + (alongZ ? 0.51 * Math.sign(dir.z) : 0));
    const frontCol = Math.floor(center.x + (alongZ ? 0 : 0.51 * Math.sign(dir.x)));
    const halfSpan = alongZ ? halfSize.x : halfSize.z;
    const spanStart = Math.floor((alongZ ? center.x : center.z) - halfSpan + 0.01);
    const spanEnd = Math.floor((alongZ ? center.x : center.z) + halfSpan - 0.01);

    const blockers: {row: number, col: number}[] = [];
    for (let along = spanStart; along <= spanEnd; ++along)
    {
        const row = alongZ ? frontRow : along;
        const col = alongZ ? along : frontCol;
        const voxel = VoxelQueryUtil.getVoxel(voxels, row, col);
        if (voxel == undefined)
            continue;
        for (let layer = Math.max(COLLISION_LAYER_MIN, bottomLayer);
            layer <= Math.min(COLLISION_LAYER_MAX, topLayer); ++layer)
        {
            if (VoxelQueryUtil.isVoxelCollisionLayerOccupied(voxel, layer))
            {
                blockers.push({row, col});
                break;
            }
        }
    }
    return blockers;
}

// Metadata given the way the game's own keys are named — `{Label: "Library", ImagePath: "1/14"}` —
// so a set is dressed in the vocabulary the objects themselves are described in, rather than in a
// second one invented for the harness. Every value goes through the same preprocessing a user's
// would, so what a sandbox door carries is what a door carries.
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
    // Installed under the same condition as the read-only bridge: away from the site the outside
    // world is meant to reach. Unlike that one this surface does change the client's own state, so
    // the gate is doing more work here — but only ever to this one browser's view of the room, by a
    // path a player already has through walking and looking.
    install: (env: ThingsPoolEnv): void =>
    {
        if (env.mode != "dev" && env.serverType != "Staging")
            return;

        (window as any).__thingspool_setup = {
            // Where the player is standing and which way he is facing. This is the question
            // `nav.js` used to answer by decoding his transform off the socket, and it is the same
            // answer without a second copy of the wire format to keep in step.
            pose: () => describePose(),

            // Everywhere in the room the player could be put down, nearest first. A room stands two
            // storeys tall with a floor across the middle, so the same cell can appear twice at
            // different heights, and `collisionLayer` is what tells them apart.
            //
            // This is what a script consults instead of walking the room to find out what is in it:
            // the grid it reads is the one the room was built from.
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

            // Stands the player at a point, at the cell's own standing height. Which height that is
            // matters on the storey above, where the same x and z also name a spot on the ground
            // floor; `collisionLayer` picks between them, and without one the layer nearest the one
            // he is already on is taken, so a walk across a storey stays on that storey.
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

            // The view the orbit camera should take up: the two angles it circles its target on, and
            // how far in the zoom is pushed (0 as far back as the mode allows, 1 as close as it
            // allows). Asked for rather than written, because pointing the camera at something
            // frames it afresh from wherever the camera stood — the request survives that framing
            // and is taken up after it.
            //
            // Only orbit mode has such a view; in play mode the camera is at the player's eye, and
            // this is taken up when edit mode is next entered.
            look: (view: {azimuthDeg?: number, polarDeg?: number, zoom?: number}) =>
            {
                const current = orbitCameraAnglesObservable.peek();
                const azimuth = view.azimuthDeg == undefined
                    ? current.azimuth : view.azimuthDeg * Math.PI / 180;
                const polar = view.polarDeg == undefined
                    ? current.polar : view.polarDeg * Math.PI / 180;
                const zoomAmount = view.zoom == undefined ? orbitCameraZoomObservable.peek() : view.zoom;
                orbitCameraViewRequestObservable.set({azimuth, polar, zoomAmount});
                // Reported in the same units it is asked in, so a caller can swing relative to where
                // the view already is without converting on the way past.
                return {azimuthDeg: azimuth * 180 / Math.PI, polarDeg: polar * 180 / Math.PI,
                    zoom: zoomAmount};
            },

            // Where the orbit is looking from now. Reading it is how a shot comes round off the
            // square-on view it opens at — the mode frames whatever is selected from wherever the
            // camera already stood, so the angle to swing from is not knowable in advance.
            view: () =>
            {
                const angles = orbitCameraAnglesObservable.peek();
                return {
                    azimuthDeg: angles.azimuth * 180 / Math.PI,
                    polarDeg: angles.polar * 180 / Math.PI,
                    zoom: orbitCameraZoomObservable.peek(),
                };
            },

            // Holds the orbit on a point of the room rather than on whatever is selected, which is
            // how a shot is composed around something that is not the subject of an edit. Given back
            // with clearLookAt.
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

            // The sandbox: an empty single-player room, entered with ?sandboxuser=<name>, whose
            // camera is unbound from the player and whose contents may be stood up by calling.
            //
            // It is the studio the dev-log's photographs are taken in. A capture otherwise has to
            // find its subject somewhere in a generated room — a wall that will take a door, a
            // staircase with a clear view up it — and most of a run is spent searching for one and
            // then photographing it from wherever it turned out to be, through an orbit that frames
            // whatever is selected rather than whatever the picture wanted. In here the set is built
            // to suit the frame and the camera is put where the picture wants it, which is the
            // difference between composing a shot and hunting for one.
            //
            // Nothing in here arose by itself, and that is what a set is. The blocks are the walls
            // and floor of the room being shown, the pictures and doors are its furniture, and the
            // camera is a photographer's rather than a player's. What the picture has to be honest
            // about is the thing it is of — a material, a shape, a doorway — not the room built to
            // stand it in.
            sandbox: {
                // Whether this client is in the sandbox at all, so a script can say so plainly
                // instead of failing at its first build call.
                active: () =>
                {
                    const room = App.getCurrentRoom();
                    return room != undefined &&
                        room.roomType == RoomTypeEnumMap.SinglePlayer &&
                        room.roomName == SANDBOX_SINGLE_PLAYER_MODE;
                },

                // Where the camera stands and what it is aimed at, in world coordinates. Free of
                // the player and free of the selection, so the two are set outright rather than
                // arrived at: no orbit to swing around a subject, and no eye to walk to a vantage.
                //
                // Either half may be given alone — moving without re-aiming keeps the subject in
                // frame, which is how a shot is dollied in or lifted over its set.
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

                // Stands a box of blocks up, finished in one texture of the room's pack. The region
                // is a corner cell and a size in cells and layers, so a plinth, a wall and a single
                // block are all the same call.
                //
                // `validate` is off for the same reason it is off everywhere else here: there is no
                // user action to check a permission for.
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

                // What the whole set is finished in. A pack is the set of textures a room's blocks
                // can wear, and swapping it re-dresses everything already standing — so it is the
                // one decision worth making before building rather than after.
                //
                // Called with nothing it only reports, which is how a script finds out what there
                // is to choose from.
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

                // The texture indices the game itself finishes rooms in, pack by pack: which index
                // reads as a floor, a ceiling, a wall and a prop, in combinations chosen to go
                // together. A set dressed out of one of these looks like somewhere the game would
                // build; one dressed out of indices picked at random looks like a paint chart.
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

                // The paintings a canvas can carry, with who painted each one. A wall with a real
                // picture on it is the cheapest thing that makes a set read as a room rather than as
                // a heap of blocks, and the titles are what a script picks one by.
                pictures: () =>
                {
                    requireSandboxRoom("Listing the pictures");
                    return ImageMapUtil.getImageMap("CanvasImageMap").getImageMetadataList()
                        .map(image => ({path: image.path, title: image.title, author: image.author}));
                },

                // The finishes a door can be given, ready to hand back as metadata.
                //
                // A door nobody chose the colors of takes one of these at random, seeded from its
                // own id — which is the right behaviour in a room and the wrong one in a
                // photograph, where the throw of the dice regularly comes up with several doors in
                // a row wearing the same paint. A set showing what doors can look like has to
                // choose, so these are the same twelve the customizing form offers, encoded the way
                // that form and the room generator both encode them.
                // Each is returned as the metadata it would be given as, and carries nothing else —
                // so one spreads straight into an `addObject` call beside the door's name, rather
                // than having to be picked a field out of.
                doorStyles: () =>
                {
                    requireSandboxRoom("Listing the door finishes");
                    return DoorCompositionConstants.colorSchemes.map(colors => ({
                        InstancedMeshComposition: CompositionMetadataUtil.encode(
                            InstancedMeshCompositionCodecTypeEnumMap.Door, 0, {colors}),
                    }));
                },

                // Hangs a picture or a door on the face of a cell.
                //
                // Given as a cell and a side of it rather than as a point in the room, because that
                // is how the wall it goes on was built: the block work is laid out in cells, and an
                // attachment naming its own coordinates would have to be kept in step with the wall
                // by hand every time the set moved. The height comes from the same place — the layer
                // named — and `y` is there for the times a set puts a floor under the wall.
                //
                // What goes up is a real object of the room, spawned through the same factory a
                // clicked one is and carrying the same metadata, so it is drawn, lit and framed like
                // any other. The only thing skipped is the permission check, for the same reason it
                // is skipped everywhere else here: there is no user action to check one for.
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

                    // A door stands on the floor in front of the wall, with its bottom edge on the
                    // line where the two meet. Its origin sits half a doorway above that, a wall
                    // attachment's collider being centred on its position. `y` overrides, for the
                    // shot that wants something else.
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

                    // The stricter rule a photograph needs, asked first because it is the specific
                    // answer: an object with block work across part of it is a bad frame, and the
                    // general check below would report the same set-up as "no wall will hold it".
                    const colliderState = PhysicsColliderStateUtil.getObjectColliderState(
                        objectTypeIndex, pos, place.dir);
                    const blockers = colliderState == undefined ? []
                        : blockersInFrontOf(room.voxelGrid.voxels, colliderState, place.dir);
                    if (blockers.length > 0)
                    {
                        throw new Error(`A ${spec.type} on the "${face}" face of cell ` +
                            `[row ${spec.row}, col ${spec.col}] would be hidden behind the block ` +
                            `work at ` +
                            `${blockers.map(b => `[row ${b.row}, col ${b.col}]`).join(", ")}. ` +
                            `Move it along the wall, or take that block work away.`);
                    }

                    // The game's own rule for whether a wall will hold this, which is worth putting
                    // back even though the permission check is not: it is the one that catches an
                    // object hung on the face of an empty cell, which hangs in mid-air and reads as
                    // deliberate until the camera moves. It also refuses one laid over another.
                    if (!WallAttachedObjectUtil.canPlaceObject(room, objectId, objectTypeIndex,
                        pos, place.dir))
                    {
                        throw new Error(`No wall will hold a ${spec.type} on the "${face}" face of ` +
                            `cell [row ${spec.row}, col ${spec.col}] at y ${y}. Either nothing is ` +
                            `standing in that cell over the object's height — name the wall's own ` +
                            `cell, not the one in front of it — or something is already hanging there.`);
                    }

                    const signal = new AddObjectSignal(room.id, user.id, user.userName,
                        objectTypeIndex, objectId,
                        new ObjectTransform(pos, place.dir), metadataFrom(spec.metadata));

                    const gameObject = ObjectFactory.createServerSideObject(signal);
                    if (!await ClientObjectManager.addObject(gameObject, false))
                        throw new Error(`The room would not take a ${spec.type} there.`);

                    return {objectId, type: spec.type, x: place.x, y, z: place.z, dir: place.dir};
                },

                // Takes one down again, by the id it was given when it went up.
                //
                // Checked for here rather than left to the removal itself, which skips its own
                // check along with the permission one and then reads the object it was not given —
                // so an id that names nothing comes back as an error about a missing property
                // instead of as the sentence a caller can act on.
                removeObject: async (objectId: string) =>
                {
                    const room = requireSandboxRoom("Taking an object down");
                    if (room.objectById[objectId] == undefined)
                        throw new Error(`No object "${objectId}" is standing in the room.`);
                    await ClientObjectManager.removeObject(objectId, false);
                    return {objectId};
                },

                // Lays the stretches of the room that only a superuser may edit over the set, so
                // that what a zone looks like can be photographed (see
                // @docs/gameplay/restricted_zone.md). Each one is a rectangle of cells, given in
                // rows and columns alone because a zone always reaches the whole height of the room.
                //
                // The list replaces whatever the room holds rather than adding to it, which is how
                // the game itself changes them: drawing a zone, moving one, resizing one and taking
                // one away are all the same request. Called with nothing it only reports, which is
                // how a script reads back what it laid.
                //
                // What is arranged here is the state; the red outlines are the game's own, painted
                // by the voxel material over every face of every cell a zone stands over. **They
                // are drawn in edit mode only** — a shot of them stands the zones up and then
                // enters the mode through the button that does it, the sandbox's free camera being
                // unmoved by either.
                //
                // The game's own rule for who may lay a zone is asked rather than skipped, unlike
                // everywhere else here: a single-player room's own player is its superuser, so the
                // check passes on its own terms, and asking it is also what catches a rectangle
                // that is inside out or off the edge of the grid.
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

                // Empties the set back to the bare floor it was generated as, so one session can
                // arrange several shots without each inheriting the last one's scenery.
                //
                // The player is the one thing left standing: he is the room's, not the set's, and
                // taking him away would leave the camera hanging off nothing.
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

                    // A zone outlines whatever cells it stands over, so one left behind would paint
                    // the *next* set red wherever the two happen to overlap — scenery inherited
                    // from the last shot, which is the whole of what this call is for.
                    ClientVoxelManager.setRestrictedZones(room, []);

                    FreeCameraPose.reset();
                    return AutomationSetupUtil.describeFreeCamera();
                },
            },
        };
    },

    // Reported in the same terms `camera` is asked in, plus the direction the two of them imply —
    // which is what a caller wanting to move along the line of sight needs and would otherwise
    // work out again from the pair.
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
