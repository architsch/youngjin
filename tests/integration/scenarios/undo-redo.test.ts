/**
 * Scenario tests: undoing and redoing what the user did in edit mode: their own edits of a room, and the
 * selections they made by hand between them (see ClientEventHistoryUtil, RoomEditUtil). Covers: the order
 * steps are taken in, one at a time; a new event ending what could be redone; an edit the room refuses
 * being dropped for the one before it, and a skippable event passed over; the scripted lock on both; edits
 * typed in quick succession counting as one; the lists emptied as edit mode ends and on arriving in a
 * room; each kind of edit taken back and made again as the user's own (checked, applied, and sent as the
 * signals that undo it): blocks put up, taken down, reshaped and painted, objects hung, taken down, moved,
 * turned and given other values, a block taken down with what hung on it; a single-player room sending
 * nothing; where each step leaves the selection; and selections by a click or a movement key undone and
 * redone, in their order among the edits.
 * Browser-bound client modules are stubbed; the room, the rules, the managers, the gizmos, the object
 * tools, the click path and the key steps run for real. The face tools' own handlers are private to their
 * components, so their sequences are mirrored here.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
    const scene = new THREE.Scene();
    const canvas = {style: {cursor: ""}, clientHeight: 600,
        getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600})};
    // Voxel edits invalidate the light map (see LightBlockMap); a stub suffices.
    const lightBlockMap = { requestRecomputation() {}, resetForRoom(_voxels?: unknown) {},
        getNearbyLightAt(_worldPos: unknown, out: any) { return out.setRGB(0, 0, 0); } };
    return { default: { getCamera: () => camera, getScene: () => scene, getGameCanvas: () => canvas,
        getGameRenderer: () => ({getSize: (out: any) => out.set(800, 600)}),
        getLightBlockMap: () => lightBlockMap,
        setViewReferenceOffset: () => {}, setPointLightSurroundings: () => {},
        setRoomLightingPrefs: () => {} } };
});

vi.mock("../../../src/client/app", () => ({
    default: {
        getCurrentRoom: vi.fn(),
        getVoxelQuads: vi.fn(),
        getUser: vi.fn(),
        getEnv: vi.fn(),
    },
}));

vi.mock("../../../src/client/graphics/types/gizmo/generic/worldSpaceOutlineRect", () => ({
    default: class WorldSpaceOutlineRectStub
    {
        static async create() { return new WorldSpaceOutlineRectStub(); }
        // As the real one: its line runs this far outside the area it outlines.
        static getEdgeOffset(size: number) { return 0.5 * size + 0.08; }
        addToParent() {}
        setTransform() {}
        setTransformRaw() {}
        setVisible() {}
        setColor() {}
        isVisible() { return true; }
        dispose() {}
    },
}));

// What an edit sends the server; watched to see what each step comes to.
vi.mock("../../../src/client/networking/client/socketsClient", () => ({
    default: {
        emitAddVoxelBlockSignal: vi.fn(),
        emitRemoveVoxelBlockSignal: vi.fn(),
        emitSetVoxelBlockShapeSignal: vi.fn(),
        emitSetVoxelQuadTextureSignal: vi.fn(),
        emitAddObjectSignal: vi.fn(),
        emitRemoveObjectSignal: vi.fn(),
        emitSetObjectTransformSignal: vi.fn(),
        emitSetObjectMetadataSignal: vi.fn(),
    },
}));

import * as THREE from "three";
import App from "../../../src/client/app";
import ClientVoxelManager from "../../../src/client/voxel/clientVoxelManager";
import "../../../src/client/graphics/types/gizmo/voxelQuadEditGizmos";
import "../../../src/client/graphics/types/gizmo/objectAttachmentEditGizmos";
import GizmoDragUtil from "../../../src/client/graphics/util/gizmoDragUtil";
import SelectionEditGizmoUtil from "../../../src/client/graphics/util/selectionEditGizmoUtil";
import ObjectSelection from "../../../src/client/graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../src/client/graphics/types/gizmo/voxelQuadSelection";
import SelectionStepUtil from "../../../src/client/graphics/util/selectionStepUtil";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import VoxelGameObject from "../../../src/client/object/types/gameObject/voxelGameObject";
import ClientObjectManager from "../../../src/client/object/clientObjectManager";
import ObjectFactory from "../../../src/client/object/factories/objectFactory";
import VoxelQuadInstanceUtil from "../../../src/client/voxel/util/voxelQuadInstanceUtil";
import SocketsClient from "../../../src/client/networking/client/socketsClient";
import ObjectEditUtil from "../../../src/client/ui/util/objectEditUtil";
import ClientEvent from "../../../src/client/system/types/clientEvent";
import { ClientEventType } from "../../../src/client/system/types/clientEventType";
import ClientEventHistoryUtil from "../../../src/client/system/util/clientEventHistoryUtil";
import GameModeUtil from "../../../src/client/system/util/gameModeUtil";
import RoomEditUtil from "../../../src/client/system/util/roomEditUtil";
import { clientFeatureFlagsObservable, gameModeObservable, objectSelectionObservable,
    orbitCameraAngleHoldRequestObservable, popupStateObservable, roomChangedObservable,
    voxelQuadSelectionObservable } from "../../../src/client/system/clientObservables";
import { FeatureFlag } from "../../../src/shared/system/types/featureFlag";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, LABEL_COLOR_PALETTE_NAME, UNIT_VEC3, VOXEL_BLOCK_SHAPE_EMPTY,
    VOXEL_BLOCK_SHAPE_WHOLE } from "../../../src/shared/system/sharedConstants";
import EncodableData from "../../../src/shared/networking/types/encodableData";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ColorUtil from "../../../src/shared/math/util/colorUtil";
import Vec3 from "../../../src/shared/math/types/vec3";
import VoxelQueryUtil from "../../../src/shared/voxel/util/voxelQueryUtil";
import VoxelUpdateUtil from "../../../src/shared/voxel/util/voxelUpdateUtil";
import RestrictedZone from "../../../src/shared/voxel/types/restrictedZone";
import AddVoxelBlockSignal from "../../../src/shared/voxel/types/update/addVoxelBlockSignal";
import RemoveVoxelBlockSignal from "../../../src/shared/voxel/types/update/removeVoxelBlockSignal";
import SetVoxelBlockShapeSignal from "../../../src/shared/voxel/types/update/setVoxelBlockShapeSignal";
import SetVoxelQuadTextureSignal from "../../../src/shared/voxel/types/update/setVoxelQuadTextureSignal";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import ObjectAttachmentUtil from "../../../src/shared/object/util/objectAttachmentUtil";
import ObjectUpdateUtil from "../../../src/shared/object/util/objectUpdateUtil";
import LabelTextUtil from "../../../src/shared/object/util/labelTextUtil";
import QuarterTurnsUtil from "../../../src/shared/object/util/quarterTurnsUtil";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import RemoveObjectSignal from "../../../src/shared/object/types/removeObjectSignal";
import { ObjectMetadata } from "../../../src/shared/object/types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import Room from "../../../src/shared/room/types/room";
import RoomRuntimeMemory from "../../../src/shared/room/types/roomRuntimeMemory";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { createEditingUser } from "../helpers/mockUser";
import { createRoom, forceSelect, quadIndexOf, voxelAt } from "../helpers/selectionHarness";
import { drag, placeCamera, screenPointOf, ScreenPoint } from "../helpers/gizmoHarness";
import { FakeInput, focus, stubFocus } from "../helpers/focusStub";

// The acting user: an admin, who is a hub's superuser (labels are theirs to put up).
const actingUser = createEditingUser();

const ROOM_ID = "undo-room";
const TEXTURES = [1, 2, 3, 4, 5, 6];
const OTHER_TEXTURES = [11, 12, 13, 14, 15, 16];
const WEST_HALF = 0b0101, NORTH_HALF = 0b0011;

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");
const labelTypeIndex = ObjectTypeConfigMap.getIndexByType("Label");
const voxelTypeIndex = ObjectTypeConfigMap.getIndexByType("Voxel");

// A block standing by itself on the room's floor, well away from the walls.
const ROW = 16, COL = 10, LAYER = COLLISION_LAYER_MIN;
const MID_Y = (LAYER + 0.5) * COLLISION_LAYER_HEIGHT;
const BLOCK_QUAD = quadIndexOf(ROW, COL, "y", "-", LAYER); // the first of the block's quads, which signals name it by
const SOUTH_FACE = quadIndexOf(ROW, COL, "z", "+", LAYER);
const TOP_FACE = quadIndexOf(ROW, COL, "y", "+", LAYER);

// A free-standing wall running east-west, five cells long and two units high, whose south face (at
// z = WALL_Z) objects hang on.
const WALL_ROW = 10, WALL_COL_MIN = 8, WALL_COL_MAX = 12, WALL_LAYERS = 4;
const WALL_Z = WALL_ROW + 1;
const SOUTH = {x: 0, y: 0, z: 1};

let room: Room;
let numObjects = 0;

// ─── The room ───────────────────────────────────────────────────────────────

function shapeAt(row: number, col: number, layer: number = LAYER): number
{
    return VoxelQueryUtil.getVoxelBlockShapeAt(room.voxelGrid.voxels, row, col, layer);
}

function textureAt(quadIndex: number): number
{
    return room.voxelGrid.quadsMem.quads[quadIndex] & 0b01111111;
}

function texturesAt(row: number, col: number, layer: number = LAYER): number[]
{
    const first = VoxelQueryUtil.getFirstVoxelQuadIndexInLayer(row, col, layer);
    return TEXTURES.map((_texture, i) => textureAt(first + i));
}

// Puts a block up as generation would: nothing is checked, sent or entered in the history.
function putBlock(row: number, col: number, layer: number = LAYER, shape: number = VOXEL_BLOCK_SHAPE_WHOLE): void
{
    VoxelUpdateUtil.addVoxelBlock(undefined, room.voxelGrid.voxels, quadIndexOf(row, col, "y", "+", layer), TEXTURES,
        undefined, shape);
}

const rounded = (v: Vec3) => [v.x, v.y, v.z].map(n => Math.round(n * 1000) / 1000);

function transformOf(objectId: string): {pos: number[], scale: number[]}
{
    const {pos, scale} = room.objectById[objectId].transform;
    return {pos: rounded(pos), scale: rounded(scale)};
}

function metadataOf(objectId: string, key: number): string | undefined
{
    return room.objectById[objectId].metadata[key]?.str;
}

// The signals sent since the last time this was asked, in the order sent, as [kind, ...what they say].
function sentSignals(): unknown[][]
{
    const sent: {order: number, entry: unknown[]}[] = [];
    const collect = (emit: unknown, describe: (signal: any) => unknown[]) => {
        const mock = (emit as Mock).mock;
        mock.calls.forEach(([signal], i) => sent.push({order: mock.invocationCallOrder[i], entry: describe(signal)}));
        (emit as Mock).mockClear();
    };
    collect(SocketsClient.emitAddVoxelBlockSignal,
        signal => ["addBlock", signal.quadIndex, [...signal.quadTextureIndicesWithinLayer], signal.shape]);
    collect(SocketsClient.emitRemoveVoxelBlockSignal, signal => ["removeBlock", signal.quadIndex]);
    collect(SocketsClient.emitSetVoxelBlockShapeSignal, signal => ["reshape", signal.quadIndex, signal.shape]);
    collect(SocketsClient.emitSetVoxelQuadTextureSignal, signal => ["texture", signal.quadIndex, signal.textureIndex]);
    collect(SocketsClient.emitAddObjectSignal, signal => ["addObject", signal.objectId, signal.sourceUserID]);
    collect(SocketsClient.emitRemoveObjectSignal, signal => ["removeObject", signal.objectId]);
    collect(SocketsClient.emitSetObjectTransformSignal,
        signal => ["transform", signal.objectId, rounded(signal.transform.pos), rounded(signal.transform.scale)]);
    // (A value that changes the object's size comes with the transform it needs.)
    collect(SocketsClient.emitSetObjectMetadataSignal, signal => ["metadata", signal.objectId, signal.metadataKey,
        signal.metadataValue, ...(signal.transform ? [rounded(signal.transform.pos), rounded(signal.transform.scale)] : [])]);
    return sent.sort((a, b) => a.order - b.order).map(({entry}) => entry);
}

// Lets what a selection sets going come to rest: each kind's listener may wait a tick (see ObjectSelection).
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function selectedQuadIndex(): number | undefined
{
    return voxelQuadSelectionObservable.peek()?.quadIndex;
}

function selectedObjectId(): string | undefined
{
    return objectSelectionObservable.peek()?.gameObject.params.objectId;
}

// ─── Edits as the user's tools make them ────────────────────────────────────
// The face tools' handlers (see VoxelQuadPlacementOptions, VoxelQuadTextureOptions) are private to their
// components, so their sequences are mirrored here; keep in step.

// What the texture strip does on a click.
function userPaints(quadIndex: number, textureIndex: number): void
{
    const signal = new SetVoxelQuadTextureSignal(room.id, quadIndex, textureIndex);
    const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
    expect(ClientVoxelManager.setVoxelQuadTexture(room, quadIndex, textureIndex)).toBe(true);
    send(() => SocketsClient.emitSetVoxelQuadTextureSignal(signal));
    RoomEditUtil.record(ClientEventType.ManuallyChangedVoxelQuadTexture, room, {redo: [signal], undo: [undoSignal]});
}

// What the "add block" button does on the selected face: a block against it, or its own block grown out to its
// cell's side, with the selection moved onto the block made or grown.
function userAddsBlock(textures: number[] = TEXTURES): void
{
    const selection = voxelQuadSelectionObservable.peek()!;
    const target = VoxelQueryUtil.getVoxelBlockAddTarget(room.voxelGrid.voxels, selection.quadIndex)!;
    let made: {type: ClientEventType, redo: EncodableData, undo: EncodableData};
    if (target.grows)
    {
        const signal = new SetVoxelBlockShapeSignal(room.id, target.quadIndex, target.shape);
        made = {type: ClientEventType.ManuallyChangedVoxelBlockShape, redo: signal,
            undo: RoomEditUtil.getUndoSignal(room, signal)};
        expect(ClientVoxelManager.setVoxelBlockShape(room, target.quadIndex, target.shape)).toBe(true);
        send(() => SocketsClient.emitSetVoxelBlockShapeSignal(signal));
    }
    else
    {
        const signal = new AddVoxelBlockSignal(room.id, target.quadIndex, textures, target.shape);
        made = {type: ClientEventType.ManuallyAddedVoxelBlock, redo: signal, undo: RoomEditUtil.getUndoSignal(room, signal)};
        expect(ClientVoxelManager.addVoxelBlock(room, target.quadIndex, textures, true, target.shape)).toBe(true);
        send(() => SocketsClient.emitAddVoxelBlockSignal(signal));
    }
    VoxelQuadSelection.unselect();
    VoxelQuadSelection.trySelectBestQuad(VoxelQueryUtil.getVoxel(room.voxelGrid.voxels,
        VoxelQueryUtil.getVoxelRowFromQuadIndex(target.quadIndex), VoxelQueryUtil.getVoxelColFromQuadIndex(target.quadIndex))!,
        target.quadIndex);
    RoomEditUtil.record(made.type, room, {redo: [made.redo], undo: [made.undo], selectionBefore: selection});
}

// What the "remove block" button does on the selected face: what hangs on its block first, then the block,
// with the selection moved to the face behind it.
async function userRemovesBlock(): Promise<void>
{
    const selection = voxelQuadSelectionObservable.peek()!;
    const quadIndex = selection.quadIndex;
    const removals: EncodableData[] = [];
    const restorals: EncodableData[] = [];
    for (const objectId of ObjectAttachmentUtil.getObjectIdsAttachedToVoxelBlock(room, quadIndex))
    {
        const signal = new RemoveObjectSignal(room.id, objectId);
        const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
        expect(await ClientObjectManager.removeObject(objectId)).toBe(true);
        send(() => SocketsClient.emitRemoveObjectSignal(signal));
        removals.push(signal);
        restorals.unshift(undoSignal);
    }

    const signal = new RemoveVoxelBlockSignal(room.id, quadIndex);
    const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
    expect(ClientVoxelManager.removeVoxelBlock(room, quadIndex)).toBe(true);
    removals.push(signal);
    restorals.unshift(undoSignal);
    VoxelQuadSelection.unselect();
    // (The face tools look one cell back along the way the face looks; these scenarios remove from the south.)
    const behind = VoxelQueryUtil.getVoxel(room.voxelGrid.voxels, selection.voxel.row - 1, selection.voxel.col)!;
    VoxelQuadSelection.trySelectBestQuad(behind, quadIndexOf(behind.row, behind.col, "z", "+",
        VoxelQueryUtil.getVoxelQuadCollisionLayerFromQuadIndex(quadIndex)));
    send(() => SocketsClient.emitRemoveVoxelBlockSignal(signal));
    RoomEditUtil.record(ClientEventType.ManuallyRemovedVoxelBlock, room,
        {redo: removals, undo: restorals, selectionBefore: selection});
}

// What picking a look from a face's chooser does: the object goes up and is selected.
async function userHangs(objectTypeIndex: number, pos: Vec3, dir: Vec3, scale: Vec3,
    metadata: ObjectMetadata = {}): Promise<string>
{
    const objectId = `object-${++numObjects}`;
    const signal = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, objectTypeIndex, objectId,
        new ObjectTransform({...pos}, {...dir}, {...scale}), metadata);
    const selectionBefore = voxelQuadSelectionObservable.peek();
    const gameObject = ObjectFactory.createServerSideObject(signal);
    expect(await ClientObjectManager.addObject(gameObject)).toBe(true);
    send(() => SocketsClient.emitAddObjectSignal(signal));
    VoxelQuadSelection.unselect();
    ObjectSelection.trySelect(gameObject);
    RoomEditUtil.record(ClientEventType.ManuallyAddedObject, room,
        {redo: [signal], undo: [RoomEditUtil.getUndoSignal(room, signal)], selectionBefore});
    await settle();
    return objectId;
}

// (The tools send nothing from a single-player room, which has no server.)
function send(emit: () => void): void
{
    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        emit();
}

// ─── Selections as the user makes them ──────────────────────────────────────

// A click on a face, through the real click path (see GameObject.onClick).
function userClicksFace(quadIndex: number): void
{
    const voxel = voxelAt(room, VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex));
    // A click names a mesh instance, so the quad must hold one (see VoxelQuadInstanceUtil).
    const instanceId = 0;
    VoxelQuadInstanceUtil.bind(quadIndex, instanceId);
    try
    {
        // A real VoxelGameObject, so the click is handled exactly as a real one.
        const clicked = Object.assign(Object.create(VoxelGameObject.prototype), {
            params: {objectTypeIndex: voxelTypeIndex, metadata: {}},
            config: ObjectTypeConfigMap.getConfigByIndex(voxelTypeIndex),
            getVoxel: () => voxel,
        }) as VoxelGameObject;
        clicked.onClick(instanceId, new THREE.Vector3());
    }
    finally
    {
        VoxelQuadInstanceUtil.unbind(quadIndex, instanceId);
    }
}

// A click on an object, which each kind's listener may wait a tick over.
async function userClicksObject(objectId: string): Promise<void>
{
    ClientObjectManager.getObjectById(objectId)!.onClick(-1, new THREE.Vector3());
    await settle();
}

// ─── Objects ────────────────────────────────────────────────────────────────

// The game object the client would make of a signal, as far as the manager, the selection and the tools look
// at one.
function fakeGameObject(params: AddObjectSignal): GameObject
{
    const position = new THREE.Vector3(params.transform.pos.x, params.transform.pos.y, params.transform.pos.z);
    return {
        params,
        position,
        quaternion: new THREE.Quaternion(),
        obj: {scale: new THREE.Vector3(1, 1, 1)},
        components: {},
        update: GameObject.prototype.update,
        setObjectTransform: (to: Vec3) => { position.set(to.x, to.y, to.z); },
        onSetMetadata: () => {},
        onSpawn: async () => {},
        onDespawn: async () => {},
        canBeSelected: () => true,
        // A click on it is handled as on a real one.
        onClick: GameObject.prototype.onClick,
        trySelect: GameObject.prototype.trySelect,
    } as unknown as GameObject;
}

// Stands an object in the room as generation would, under somebody else's name: nothing is checked, sent or
// entered in the history.
async function standObject(objectTypeIndex: number, pos: Vec3, dir: Vec3, scale: Vec3,
    metadata: ObjectMetadata = {}): Promise<string>
{
    const objectId = `object-${++numObjects}`;
    const gameObject = fakeGameObject(new AddObjectSignal(room.id, "somebody-else", "Somebody Else", objectTypeIndex,
        objectId, new ObjectTransform({...pos}, {...dir}, {...scale}), metadata));
    expect(await ClientObjectManager.addObject(gameObject, false)).toBe(true);
    return objectId;
}

async function select(objectId: string): Promise<ObjectSelection>
{
    expect(ObjectSelection.trySelect(ClientObjectManager.getObjectById(objectId)!)).toBe(true);
    await settle();
    return objectSelectionObservable.peek()!;
}

// A canvas a block across and a layer tall, on the south face of the block standing by itself.
const ON_BLOCK = {pos: {x: COL + 0.5, y: MID_Y, z: ROW + 1}, scale: {x: 1, y: 0.5, z: 1}};
// A canvas a block square on the wall's south face, centred a unit up.
const onWallAt = (x: number) => ({x, y: 1, z: WALL_Z});

// A label on the boundary wall, clear of the room's door (see label.test.ts).
const LABEL_POS = {x: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL - 4.5, y: 2.25, z: INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW};
const LABEL_DIR = {x: 0, y: 0, z: -1};
const labelled = (text: string): ObjectMetadata => ({[ObjectMetadataKeyEnumMap.Label]: new EncodableByteString(text)});

// ─── The view, for the gizmos ───────────────────────────────────────────────

// From the south of the lone block and above it, so that its top and south faces show.
function lookAtTheBlock(): void
{
    placeCamera({x: COL + 0.5, y: 3.2, z: ROW + 5}, {x: COL + 0.5, y: MID_Y, z: ROW + 0.5});
}

// From the south of the wall and level with its middle.
function lookAtTheWall(): void
{
    placeCamera({x: 10.5, y: 1.2, z: WALL_Z + 6}, {x: 10.5, y: 1, z: WALL_Z});
}

function handle(id: string): ScreenPoint
{
    const found = SelectionEditGizmoUtil.getGrabPoints()?.handles.find(candidate => candidate.id == id);
    if (found == undefined)
        throw new Error(`No handle "${id}" is shown`);
    return {x: found.x, y: found.y};
}

// Where the pointer has to be for the lone block's east or west bound to be asked to a place across its cell.
const onSouthFace = (acrossCell: number) => screenPointOf({x: COL + acrossCell, y: MID_Y, z: ROW + 1});
const onWall = (x: number, y: number) => screenPointOf({x, y, z: WALL_Z});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    stubFocus();

    clientFeatureFlagsObservable.tryRemove(FeatureFlag.DisableUndoRedo);
    gameModeObservable.set("edit");
    voxelQuadSelectionObservable.set(null);
    objectSelectionObservable.set(null);
    orbitCameraAngleHoldRequestObservable.set(false);
    ClientEventHistoryUtil.clear();

    (App.getUser as Mock).mockReturnValue(actingUser);
    room = createRoom(ROOM_ID);
    (App.getCurrentRoom as Mock).mockReturnValue(room);
    (App.getVoxelQuads as Mock).mockReturnValue(room.voxelQuads);
    putBlock(ROW, COL);
    for (let col = WALL_COL_MIN; col <= WALL_COL_MAX; ++col)
    {
        for (let layer = COLLISION_LAYER_MIN; layer < COLLISION_LAYER_MIN + WALL_LAYERS; ++layer)
            putBlock(WALL_ROW, col, layer);
    }
    vi.spyOn(ObjectFactory, "createServerSideObject").mockImplementation(fakeGameObject);
    lookAtTheBlock();
    sentSignals();
});

afterEach(async () => {
    GizmoDragUtil.cancel();
    ClientVoxelManager.cancelVoxelBlockPreview();
    await settle();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

// ─── The history ────────────────────────────────────────────────────────────

describe("the order edits are undone and redone in", () => {
    let log: string[];

    // An edit that only notes being undone and redone, and says whether each took.
    function edit(name: string, more: {undoes?: boolean, redoes?: boolean, mergeKey?: string, time?: number,
        skippable?: boolean} = {}): ClientEvent
    {
        const event = new ClientEvent(ClientEventType.ManuallyAddedVoxelBlock, {
            undo: async () => { log.push(`undo ${name}`); return more.undoes ?? true; },
            redo: async () => { log.push(`redo ${name}`); return more.redoes ?? true; },
            mergeKey: more.mergeKey,
            skippable: more.skippable,
        });
        if (more.time != undefined)
            event.time = more.time;
        return event;
    }

    beforeEach(() => {
        log = [];
    });

    it("is the latest first, each way, and nothing once there is none left", async () => {
        for (const name of ["A", "B", "C"])
            ClientEventHistoryUtil.add(edit(name));

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(log).toEqual(["undo C", "undo B"]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(log).toEqual(["undo C", "undo B", "redo B", "redo C"]);

        for (const expected of ["done", "done", "done", "none"])
            expect(await ClientEventHistoryUtil.undo()).toBe(expected);
        expect(log.slice(4)).toEqual(["undo C", "undo B", "undo A"]);
    });

    it("leaves nothing to redo once a new edit is made", async () => {
        ClientEventHistoryUtil.add(edit("A"));
        ClientEventHistoryUtil.add(edit("B"));
        await ClientEventHistoryUtil.undo();

        ClientEventHistoryUtil.add(edit("C"));
        expect(await ClientEventHistoryUtil.redo()).toBe("none");

        await ClientEventHistoryUtil.undo();
        await ClientEventHistoryUtil.undo();
        expect(log).toEqual(["undo B", "undo C", "undo A"]);
    });

    it("drops an edit the room refuses, leaving the one before it next", async () => {
        ClientEventHistoryUtil.add(edit("A"));
        ClientEventHistoryUtil.add(edit("B", {undoes: false}));

        expect(await ClientEventHistoryUtil.undo()).toBe("refused");
        // (Not there to redo either: it was never undone.)
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(log).toEqual(["undo B", "undo A"]);
    });

    it("drops an edit the room refuses to have made again", async () => {
        ClientEventHistoryUtil.add(edit("A", {redoes: false}));
        await ClientEventHistoryUtil.undo();

        expect(await ClientEventHistoryUtil.redo()).toBe("refused");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
    });

    it("passes over a skippable event that doesn't take, for the one before it", async () => {
        ClientEventHistoryUtil.add(edit("A"));
        ClientEventHistoryUtil.add(edit("gone", {undoes: false, skippable: true}));
        ClientEventHistoryUtil.add(edit("gone too", {undoes: false, skippable: true}));

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(log).toEqual(["undo gone too", "undo gone", "undo A"]);

        // Passed over, they are not there to redo either.
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(log.slice(3)).toEqual(["redo A"]);
    });

    it("passes one over as it is redone too, for the one after it", async () => {
        ClientEventHistoryUtil.add(edit("gone", {redoes: false, skippable: true}));
        ClientEventHistoryUtil.add(edit("B"));
        await ClientEventHistoryUtil.undo();
        await ClientEventHistoryUtil.undo();

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(log).toEqual(["undo B", "undo gone", "redo gone", "redo B"]);
    });

    it("has nothing to say of events passed over when none is left behind them", async () => {
        ClientEventHistoryUtil.add(edit("gone", {undoes: false, skippable: true}));
        ClientEventHistoryUtil.add(edit("gone too", {undoes: false, skippable: true}));

        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(log).toEqual(["undo gone too", "undo gone"]);
    });

    it("still stops at an edit the room refuses, behind the events it passed over", async () => {
        ClientEventHistoryUtil.add(edit("A"));
        ClientEventHistoryUtil.add(edit("B", {undoes: false}));
        ClientEventHistoryUtil.add(edit("gone", {undoes: false, skippable: true}));

        expect(await ClientEventHistoryUtil.undo()).toBe("refused");
        expect(log).toEqual(["undo gone", "undo B"]);
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
    });

    it("leaves a skippable event that takes to be redone like any other", async () => {
        ClientEventHistoryUtil.add(edit("A", {skippable: true}));
        ClientEventHistoryUtil.add(edit("B", {skippable: true}));

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(log).toEqual(["undo B"]);
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(log).toEqual(["undo B", "redo B"]);
    });

    it("counts only edits, though every event is still tallied", async () => {
        ClientEventHistoryUtil.add(edit("A"));
        ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.SinglePlayerStepChanged));
        expect(await ClientEventHistoryUtil.undo()).toBe("done");

        // An event that is no edit ends nothing that could be redone.
        ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.SinglePlayerStepChanged));
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(log).toEqual(["undo A", "redo A"]);

        // An edit undone still happened, as far as the tally goes (see SinglePlayerConditionMap).
        expect(ClientEventHistoryUtil.getNumEventsAfterTime(ClientEventType.ManuallyAddedVoxelBlock, -1)).toBe(1);
        expect(ClientEventHistoryUtil.getNumEventsAfterTime(ClientEventType.SinglePlayerStepChanged, -1)).toBe(2);
    });

    it("is blocked both ways while a scripted step says so", async () => {
        ClientEventHistoryUtil.add(edit("A"));
        ClientEventHistoryUtil.add(edit("B"));
        await ClientEventHistoryUtil.undo();

        clientFeatureFlagsObservable.tryAdd(FeatureFlag.DisableUndoRedo);
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(log).toEqual(["undo B"]);

        // Neither list lost anything meanwhile.
        clientFeatureFlagsObservable.tryRemove(FeatureFlag.DisableUndoRedo);
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(log).toEqual(["undo B", "redo B", "undo B", "undo A"]);
    });

    it("takes one at a time, in the order asked for", async () => {
        // The latest edit's undoing waits to be let go.
        let letGo = () => {};
        const held = new Promise<void>(resolve => { letGo = resolve; });
        ClientEventHistoryUtil.add(edit("A"));
        ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyAddedVoxelBlock, {
            undo: async () => { log.push("undo B begins"); await held; log.push("undo B ends"); return true; },
            redo: async () => true,
        }));

        const first = ClientEventHistoryUtil.undo();
        const second = ClientEventHistoryUtil.undo();
        await settle();
        expect(log).toEqual(["undo B begins"]);

        letGo();
        expect(await first).toBe("done");
        expect(await second).toBe("done");
        expect(log).toEqual(["undo B begins", "undo B ends", "undo A"]);
    });

    it("has edits entered under one key in quick succession count as one", async () => {
        ClientEventHistoryUtil.add(edit("before"));
        ClientEventHistoryUtil.add(edit("typed 1", {mergeKey: "text", time: 1000}));
        ClientEventHistoryUtil.add(edit("typed 2", {mergeKey: "text", time: 1900}));
        ClientEventHistoryUtil.add(edit("typed 3", {mergeKey: "text", time: 2800}));

        // Undone to where the first began, and redone to where the last ended.
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(log).toEqual(["undo typed 1"]);
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(log).toEqual(["undo typed 1", "redo typed 3"]);

        await ClientEventHistoryUtil.undo();
        await ClientEventHistoryUtil.undo();
        expect(log.slice(2)).toEqual(["undo typed 1", "undo before"]);
    });

    it("keeps them apart after a pause, under another key, or with another edit between", async () => {
        ClientEventHistoryUtil.add(edit("typed", {mergeKey: "text", time: 1000}));
        ClientEventHistoryUtil.add(edit("typed later", {mergeKey: "text", time: 2001}));
        ClientEventHistoryUtil.add(edit("other text", {mergeKey: "other", time: 2002}));
        ClientEventHistoryUtil.add(edit("a click", {time: 2003}));
        ClientEventHistoryUtil.add(edit("other text again", {mergeKey: "other", time: 2004}));

        for (let i = 0; i < 5; ++i)
            expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(log).toEqual(["undo other text again", "undo a click", "undo other text", "undo typed later", "undo typed"]);
    });

    it("starts over on arriving in a room", async () => {
        ClientEventHistoryUtil.add(edit("A"));
        ClientEventHistoryUtil.add(edit("B"));
        await ClientEventHistoryUtil.undo();

        // (Every room is arrived in play mode, which is what ends the history: see GameModeUtil.)
        roomChangedObservable.set(new RoomRuntimeMemory(room, {}));
        expect(GameModeUtil.isInEditMode()).toBe(false);
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(log).toEqual(["undo B"]);
    });

    it("keeps nothing of a step still under way as the room arrives", async () => {
        let letGo = () => {};
        const held = new Promise<void>(resolve => { letGo = resolve; });
        ClientEventHistoryUtil.add(new ClientEvent(ClientEventType.ManuallyAddedVoxelBlock, {
            undo: async () => { await held; return true; },
            redo: async () => { log.push("redo"); return true; },
        }));

        const undone = ClientEventHistoryUtil.undo();
        await settle();
        roomChangedObservable.set(new RoomRuntimeMemory(room, {}));
        letGo();
        await undone;

        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(log).toEqual([]);
    });

    it("starts over as edit mode ends, and not as it begins", async () => {
        ClientEventHistoryUtil.add(edit("A"));
        gameModeObservable.set("edit");
        expect(await ClientEventHistoryUtil.undo()).toBe("done");

        ClientEventHistoryUtil.add(edit("B"));
        ClientEventHistoryUtil.add(edit("C"));
        await ClientEventHistoryUtil.undo();
        gameModeObservable.set("play");
        gameModeObservable.set("edit");
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(log).toEqual(["undo A", "undo C"]);
    });

    it("keeps nothing of a step still under way as edit mode ends, nor goes on to the next", async () => {
        let letGo = () => {};
        const held = new Promise<void>(resolve => { letGo = resolve; });
        ClientEventHistoryUtil.add(edit("A"));
        const underWay = new ClientEvent(ClientEventType.ManuallySelectedVoxelQuad, {
            undo: async () => { await held; return false; },
            redo: async () => { log.push("redo"); return true; },
            skippable: true,
        });
        ClientEventHistoryUtil.add(underWay);

        const undone = ClientEventHistoryUtil.undo();
        await settle();
        gameModeObservable.set("play");
        // An event entered since belongs to another stay in edit mode, which the step has no business in.
        gameModeObservable.set("edit");
        ClientEventHistoryUtil.add(edit("B"));
        letGo();

        expect(await undone).toBe("none");
        expect(log).toEqual([]);
        expect(underWay.redo).toBeUndefined();
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(log).toEqual(["undo B"]);
    });

    it("lets go of how to undo and redo an event once it can be neither", async () => {
        const held = (event: ClientEvent) => [event.undo != undefined, event.redo != undefined];

        // Undone, then overtaken by a new event, which ends what could be redone.
        const overtaken = edit("overtaken");
        const kept = edit("kept");
        ClientEventHistoryUtil.add(overtaken);
        await ClientEventHistoryUtil.undo();
        ClientEventHistoryUtil.add(kept);
        expect(held(overtaken)).toEqual([false, false]);

        const refused = edit("refused", {undoes: false});
        ClientEventHistoryUtil.add(refused);
        await ClientEventHistoryUtil.undo();
        expect(held(refused)).toEqual([false, false]);

        // Passed over for the one before it, which is undone and may yet be redone.
        const passedOver = edit("passed over", {undoes: false, skippable: true});
        ClientEventHistoryUtil.add(passedOver);
        await ClientEventHistoryUtil.undo();
        expect(held(passedOver)).toEqual([false, false]);
        expect(held(kept)).toEqual([true, true]);

        gameModeObservable.set("play");
        expect(held(kept)).toEqual([false, false]);

        // One typed over by the next is undone through that one from then on.
        const typed = edit("typed", {mergeKey: "text", time: 1000});
        const typedOver = edit("typed over", {mergeKey: "text", time: 1500});
        ClientEventHistoryUtil.add(typed);
        ClientEventHistoryUtil.add(typedOver);
        expect(held(typed)).toEqual([false, false]);
        expect(held(typedOver)).toEqual([true, true]);

        // The tally of their type keeps every one of them.
        expect(ClientEventHistoryUtil.getNumEventsAfterTime(ClientEventType.ManuallyAddedVoxelBlock, -1)).toBe(6);
    });
});

// ─── Blocks ─────────────────────────────────────────────────────────────────

describe("a block's edits, undone and redone", () => {
    it("takes down a block put up, and puts it up again as it was", async () => {
        forceSelect(room, SOUTH_FACE);
        userAddsBlock(OTHER_TEXTURES);
        const built = quadIndexOf(ROW + 1, COL, "z", "+", LAYER);
        expect(shapeAt(ROW + 1, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(shapeAt(ROW + 1, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
        expect(sentSignals()).toEqual([["removeBlock", built]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(shapeAt(ROW + 1, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(texturesAt(ROW + 1, COL)).toEqual(OTHER_TEXTURES);
        expect(sentSignals()).toEqual([["addBlock", built, OTHER_TEXTURES, VOXEL_BLOCK_SHAPE_WHOLE]]);
    });

    it("puts a block taken down back with its shape and its faces' textures", async () => {
        room.voxelGrid.quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(ROW, COL, LAYER)] = NORTH_HALF;
        forceSelect(room, TOP_FACE);
        const selection = voxelQuadSelectionObservable.peek()!;
        const signal = new RemoveVoxelBlockSignal(room.id, TOP_FACE);
        const undoSignal = RoomEditUtil.getUndoSignal(room, signal);
        expect(ClientVoxelManager.removeVoxelBlock(room, TOP_FACE)).toBe(true);
        RoomEditUtil.record(ClientEventType.ManuallyRemovedVoxelBlock, room,
            {redo: [signal], undo: [undoSignal], selectionBefore: selection});
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(shapeAt(ROW, COL)).toBe(NORTH_HALF);
        expect(texturesAt(ROW, COL)).toEqual(TEXTURES);
        expect(sentSignals()).toEqual([["addBlock", BLOCK_QUAD, TEXTURES, NORTH_HALF]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
        expect(sentSignals()).toEqual([["removeBlock", TOP_FACE]]);
    });

    it("gives a face painted its texture back, and the paint again", async () => {
        userPaints(SOUTH_FACE, 40);
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(textureAt(SOUTH_FACE)).toBe(TEXTURES[5]);
        expect(sentSignals()).toEqual([["texture", SOUTH_FACE, TEXTURES[5]]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(textureAt(SOUTH_FACE)).toBe(40);
        expect(sentSignals()).toEqual([["texture", SOUTH_FACE, 40]]);
    });

    it("gives a block reshaped by a handle its shape back, and the new one again", async () => {
        forceSelect(room, SOUTH_FACE);
        expect(drag(handle("maxX"), onSouthFace(0.9), onSouthFace(0.5))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, WEST_HALF]]);

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, VOXEL_BLOCK_SHAPE_WHOLE]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(shapeAt(ROW, COL)).toBe(WEST_HALF);
        expect(sentSignals()).toEqual([["reshape", BLOCK_QUAD, WEST_HALF]]);
    });

    it("has nothing to undo after a handle's drag that came to no edit", async () => {
        forceSelect(room, SOUTH_FACE);
        // Carried in and back out again.
        expect(drag(handle("maxX"), onSouthFace(0.9), onSouthFace(0.5), onSouthFace(1))).toBe(true);
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
    });

    it("shrinks a block grown out to its cell's side back, and grows it again", async () => {
        room.voxelGrid.quadsMem.blockShapes[VoxelQueryUtil.getVoxelBlockIndex(ROW, COL, LAYER)] = NORTH_HALF;
        forceSelect(room, SOUTH_FACE);
        userAddsBlock();
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(shapeAt(ROW, COL)).toBe(NORTH_HALF);
        expect(sentSignals()).toEqual([["reshape", SOUTH_FACE, NORTH_HALF]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(sentSignals()).toEqual([["reshape", SOUTH_FACE, VOXEL_BLOCK_SHAPE_WHOLE]]);
    });

    it("goes back through several, the latest first", async () => {
        userPaints(SOUTH_FACE, 40);
        userPaints(SOUTH_FACE, 41);
        userPaints(TOP_FACE, 42);

        await ClientEventHistoryUtil.undo();
        expect([textureAt(SOUTH_FACE), textureAt(TOP_FACE)]).toEqual([41, TEXTURES[1]]);
        await ClientEventHistoryUtil.undo();
        expect(textureAt(SOUTH_FACE)).toBe(40);
        await ClientEventHistoryUtil.undo();
        expect(textureAt(SOUTH_FACE)).toBe(TEXTURES[5]);

        await ClientEventHistoryUtil.redo();
        await ClientEventHistoryUtil.redo();
        expect([textureAt(SOUTH_FACE), textureAt(TOP_FACE)]).toEqual([41, TEXTURES[1]]);
    });
});

describe("an edit the room no longer allows", () => {
    it("is refused with nothing changed or sent, and the one before it is undone next", async () => {
        userPaints(TOP_FACE, 40);
        forceSelect(room, SOUTH_FACE);
        userAddsBlock();
        // Somebody hangs a canvas on the new block, which then can't go by itself.
        expect(ObjectUpdateUtil.addObject(actingUser, room, new AddObjectSignal(room.id, actingUser.id,
            actingUser.userName, canvasTypeIndex, "somebody's-canvas", new ObjectTransform(
                {x: COL + 0.5, y: MID_Y, z: ROW + 2}, SOUTH, {x: 1, y: 0.5, z: 1})))).toBe(true);
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("refused");
        expect(shapeAt(ROW + 1, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(sentSignals()).toEqual([]);

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(textureAt(TOP_FACE)).toBe(TEXTURES[1]);
    });

    it("is refused where a restricted zone has since been drawn over it", async () => {
        // An ordinary user, whom a hub's zones bind (see RestrictedZoneUtil).
        (App.getUser as Mock).mockReturnValue(createEditingUser(UserTypeEnumMap.Member));
        userPaints(TOP_FACE, 40);
        room.voxelGrid.restrictedZones = [new RestrictedZone(ROW, ROW, COL, COL)];
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("refused");
        expect(textureAt(TOP_FACE)).toBe(40);
        expect(sentSignals()).toEqual([]);
    });

    it("is refused where what it undoes is already gone", async () => {
        forceSelect(room, SOUTH_FACE);
        userAddsBlock();
        // (As the server's answer to an add it refused takes the block away again.)
        ClientVoxelManager.removeVoxelBlock(room, quadIndexOf(ROW + 1, COL, "y", "+", LAYER), false);
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("refused");
        expect(sentSignals()).toEqual([]);
    });

    it("is refused in any room but the one it was made in", async () => {
        userPaints(SOUTH_FACE, 40);
        // A room with a block standing in the same place, whose face the undo could as well be made of.
        const elsewhere = createRoom("another-room");
        VoxelUpdateUtil.addVoxelBlock(undefined, elsewhere.voxelGrid.voxels, TOP_FACE, OTHER_TEXTURES);
        (App.getCurrentRoom as Mock).mockReturnValue(elsewhere);
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("refused");
        expect(textureAt(SOUTH_FACE)).toBe(40);
        expect(elsewhere.voxelGrid.quadsMem.quads[SOUTH_FACE] & 0b01111111).toBe(OTHER_TEXTURES[5]);
        expect(sentSignals()).toEqual([]);
    });
});

describe("in a single-player room", () => {
    it("undoes and redoes as anywhere, and sends nothing", async () => {
        room.roomType = RoomTypeEnumMap.SinglePlayer;
        userPaints(SOUTH_FACE, 40);
        forceSelect(room, SOUTH_FACE);
        userAddsBlock();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(shapeAt(ROW + 1, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
        expect(textureAt(SOUTH_FACE)).toBe(TEXTURES[5]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(textureAt(SOUTH_FACE)).toBe(40);
        expect(sentSignals()).toEqual([]);
    });
});

// ─── Objects ────────────────────────────────────────────────────────────────

describe("an object's edits, undone and redone", () => {
    it("takes down an object hung, and hangs it again as it was hung", async () => {
        const metadata = {[ObjectMetadataKeyEnumMap.QuarterTurns]: new EncodableByteString(QuarterTurnsUtil.encode(0))};
        const objectId = await userHangs(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3}, metadata);
        // Somebody else moves it meanwhile, which is no part of how it was hung.
        ClientObjectManager.setObjectTransform(objectId, new ObjectTransform(onWallAt(9.5), SOUTH, {...UNIT_VEC3}), true, false);
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(room.objectById[objectId]).toBeUndefined();
        expect(ClientObjectManager.getObjectById(objectId)).toBeUndefined();
        expect(sentSignals()).toEqual([["removeObject", objectId]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(transformOf(objectId)).toEqual({pos: [10.5, 1, WALL_Z], scale: [1, 1, 1]});
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.QuarterTurns)).toBe(QuarterTurnsUtil.encode(0));
        expect(ClientObjectManager.getObjectById(objectId)!.params).toBe(room.objectById[objectId]);
        expect(sentSignals()).toEqual([["addObject", objectId, actingUser.id]]);

        // And the same the next time round, whatever has been made of the object hung again.
        ClientObjectManager.setObjectTransform(objectId, new ObjectTransform(onWallAt(9.5), SOUTH, {...UNIT_VEC3}), true, false);
        await ClientEventHistoryUtil.undo();
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(transformOf(objectId).pos).toEqual([10.5, 1, WALL_Z]);
    });

    it("hangs an object taken down by its tools again, under the name of whoever undoes it", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        ObjectEditUtil.openRemoveConfirmPopup(await select(objectId), "Want to remove this label?");
        const popup = popupStateObservable.peek();
        expect(popup.popupType).toBe("confirm");
        (popup as Extract<typeof popup, {popupType: "confirm"}>).params.onConfirm();
        await settle();
        expect(room.objectById[objectId]).toBeUndefined();
        expect(sentSignals()).toEqual([["removeObject", objectId]]);

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(transformOf(objectId)).toEqual({pos: rounded(LABEL_POS), scale: [1, 1, 1]});
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("Library");
        expect(room.objectById[objectId].sourceUserID).toBe(actingUser.id);
        expect(sentSignals()).toEqual([["addObject", objectId, actingUser.id]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(room.objectById[objectId]).toBeUndefined();
        expect(sentSignals()).toEqual([["removeObject", objectId]]);
    });

    it("puts back a block taken down with what hung on it: the block first, then the rest", async () => {
        const objectId = await standObject(canvasTypeIndex, ON_BLOCK.pos, SOUTH, ON_BLOCK.scale);
        forceSelect(room, SOUTH_FACE);
        await userRemovesBlock();
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
        expect(room.objectById[objectId]).toBeUndefined();
        expect(sentSignals()).toEqual([["removeObject", objectId], ["removeBlock", SOUTH_FACE]]);

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_WHOLE);
        expect(transformOf(objectId)).toEqual({pos: rounded(ON_BLOCK.pos), scale: rounded(ON_BLOCK.scale)});
        expect(sentSignals()).toEqual([["addBlock", BLOCK_QUAD, TEXTURES, VOXEL_BLOCK_SHAPE_WHOLE],
            ["addObject", objectId, actingUser.id]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(shapeAt(ROW, COL)).toBe(VOXEL_BLOCK_SHAPE_EMPTY);
        expect(room.objectById[objectId]).toBeUndefined();
        expect(sentSignals()).toEqual([["removeObject", objectId], ["removeBlock", SOUTH_FACE]]);
    });

    it("puts an object dragged along its wall back where it hung, and there again", async () => {
        lookAtTheWall();
        const objectId = await userHangs(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3});
        expect(drag(onWall(10.7, 1.2), onWall(11, 1.2), onWall(11.7, 1.2))).toBe(true);
        expect(transformOf(objectId).pos).toEqual([11.5, 1, WALL_Z]);
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(transformOf(objectId).pos).toEqual([10.5, 1, WALL_Z]);
        expect(sentSignals()).toEqual([["transform", objectId, [10.5, 1, WALL_Z], [1, 1, 1]]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(transformOf(objectId).pos).toEqual([11.5, 1, WALL_Z]);
        expect(sentSignals()).toEqual([["transform", objectId, [11.5, 1, WALL_Z], [1, 1, 1]]]);
    });

    it("gives an object a tool resized its size back", async () => {
        const objectId = await userHangs(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3});
        ObjectEditUtil.trySetObjectTransform(objectSelectionObservable.peek()!,
            new ObjectTransform({x: 10.5, y: 0.75, z: WALL_Z}, SOUTH, {x: 1, y: 0.5, z: 1}));
        expect(transformOf(objectId)).toEqual({pos: [10.5, 0.75, WALL_Z], scale: [1, 0.5, 1]});
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(transformOf(objectId)).toEqual({pos: [10.5, 1, WALL_Z], scale: [1, 1, 1]});
        expect(sentSignals()).toEqual([["transform", objectId, [10.5, 1, WALL_Z], [1, 1, 1]]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(transformOf(objectId)).toEqual({pos: [10.5, 0.75, WALL_Z], scale: [1, 0.5, 1]});
    });

    it("turns an object the rotate tool turned back, its footprint with it, as the one edit it was", async () => {
        // (Upright as hung, which a canvas's tools write down as they hang it.)
        const objectId = await userHangs(canvasTypeIndex, {x: 10.5, y: 0.75, z: WALL_Z}, SOUTH, {x: 1, y: 0.5, z: 1},
            {[ObjectMetadataKeyEnumMap.QuarterTurns]: new EncodableByteString(QuarterTurnsUtil.encode(0))});
        ObjectEditUtil.tryQuarterTurn(objectSelectionObservable.peek()!);
        expect(transformOf(objectId)).toEqual({pos: [10.5, 1, WALL_Z], scale: [0.5, 1, 1]});
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(transformOf(objectId)).toEqual({pos: [10.5, 0.75, WALL_Z], scale: [1, 0.5, 1]});
        expect(QuarterTurnsUtil.getQuarterTurns(room.objectById[objectId])).toBe(0);
        expect(sentSignals()).toEqual([["metadata", objectId, ObjectMetadataKeyEnumMap.QuarterTurns,
            QuarterTurnsUtil.encode(0), [10.5, 0.75, WALL_Z], [1, 0.5, 1]]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(transformOf(objectId)).toEqual({pos: [10.5, 1, WALL_Z], scale: [0.5, 1, 1]});
        expect(QuarterTurnsUtil.getQuarterTurns(room.objectById[objectId])).toBe(1);
    });

    it("gives a value a tool set back the value it had", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        ObjectEditUtil.trySetObjectMetadata(await select(objectId), ObjectMetadataKeyEnumMap.Label, "Gallery");
        sentSignals();

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("Library");
        expect(sentSignals()).toEqual([["metadata", objectId, ObjectMetadataKeyEnumMap.Label, "Library"]]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("Gallery");
        expect(sentSignals()).toEqual([["metadata", objectId, ObjectMetadataKeyEnumMap.Label, "Gallery"]]);
    });

    it("has nothing to undo after a value set to what it already was", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        // (Stored trimmed, so the space changes nothing.)
        ObjectEditUtil.trySetObjectMetadata(await select(objectId), ObjectMetadataKeyEnumMap.Label, "Library ");
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
    });

    it("gives an ink never chosen back as the color it read as", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        const defaultIndex = LabelTextUtil.getColorIndex(room.objectById[objectId]);
        const otherIndex = (defaultIndex + 1) % ColorUtil.getPaletteSize(LABEL_COLOR_PALETTE_NAME);
        ObjectEditUtil.trySetObjectMetadata(await select(objectId), ObjectMetadataKeyEnumMap.LabelColor, `${otherIndex}`);

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(LabelTextUtil.getColorIndex(room.objectById[objectId])).toBe(defaultIndex);

        // And picking the color already shown is no edit.
        ObjectEditUtil.trySetObjectMetadata(objectSelectionObservable.peek()!, ObjectMetadataKeyEnumMap.LabelColor,
            `${defaultIndex}`);
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(LabelTextUtil.getColorIndex(room.objectById[objectId])).toBe(otherIndex);
    });
});

describe("a text typed into a field", () => {
    const type = (selection: ObjectSelection, ...texts: string[]) => {
        for (const text of texts)
            ObjectEditUtil.trySetObjectMetadata(selection, ObjectMetadataKeyEnumMap.Label, text);
    };

    it("is one edit, not one for each letter", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        const selection = await select(objectId);
        focus(new FakeInput("text"));
        type(selection, "G", "Ga", "Gal");

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("Library");
        expect(await ClientEventHistoryUtil.undo()).toBe("none");

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("Gal");
    });

    it("is another edit after a pause", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        const selection = await select(objectId);
        focus(new FakeInput("text"));
        const now = vi.spyOn(performance, "now");
        now.mockReturnValue(1000);
        type(selection, "G", "Ga");
        now.mockReturnValue(5000);
        type(selection, "Gal", "Gall");

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("Ga");
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("Library");
    });

    it("is an edit for each value set where nothing is being typed", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        type(await select(objectId), "G", "Ga", "Gal");

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("Ga");
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(metadataOf(objectId, ObjectMetadataKeyEnumMap.Label)).toBe("G");
    });
});

// ─── The selection ──────────────────────────────────────────────────────────

describe("the selection after an undo or a redo", () => {
    const BUILT_FACE = quadIndexOf(ROW + 1, COL, "z", "+", LAYER);

    it("goes back with the edit while it is still where the edit left it", async () => {
        forceSelect(room, SOUTH_FACE);
        userAddsBlock();
        expect(selectedQuadIndex()).toBe(BUILT_FACE);

        await ClientEventHistoryUtil.undo();
        expect(selectedQuadIndex()).toBe(SOUTH_FACE);
        await ClientEventHistoryUtil.redo();
        expect(selectedQuadIndex()).toBe(BUILT_FACE);
    });

    it("stays where the user has since put it", async () => {
        forceSelect(room, SOUTH_FACE);
        userAddsBlock();
        const elsewhere = quadIndexOf(WALL_ROW, WALL_COL_MIN, "z", "+", LAYER);
        forceSelect(room, elsewhere);
        const announced = vi.fn();
        voxelQuadSelectionObservable.addListener("undo-redo.test", announced);

        await ClientEventHistoryUtil.undo();
        expect(selectedQuadIndex()).toBe(elsewhere);
        // Announced again all the same, for its tools to catch up with the room.
        expect(announced).toHaveBeenCalledTimes(1);
        await ClientEventHistoryUtil.redo();
        expect(selectedQuadIndex()).toBe(elsewhere);
        voxelQuadSelectionObservable.removeListener("undo-redo.test");
    });

    it("moves on to a face that shows when the edit undone takes its face away", async () => {
        forceSelect(room, SOUTH_FACE);
        userAddsBlock();
        const builtTop = quadIndexOf(ROW + 1, COL, "y", "+", LAYER);
        forceSelect(room, builtTop);

        await ClientEventHistoryUtil.undo();
        const moved = selectedQuadIndex()!;
        expect(moved).not.toBe(builtTop);
        expect(VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, moved)).toBe(true);
    });

    it("leaves an object undone for the face it was hung from, and takes it up again as it is redone", async () => {
        lookAtTheWall();
        const hungFrom = quadIndexOf(WALL_ROW, 10, "z", "+", LAYER + 1);
        forceSelect(room, hungFrom);
        await settle();
        const objectId = await userHangs(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3});
        expect(selectedObjectId()).toBe(objectId);

        await ClientEventHistoryUtil.undo();
        await settle();
        expect(selectedQuadIndex()).toBe(hungFrom);
        expect(selectedObjectId()).toBeUndefined();

        await ClientEventHistoryUtil.redo();
        await settle();
        expect(selectedObjectId()).toBe(objectId);
        expect(selectedQuadIndex()).toBeUndefined();
    });

    it("takes up again an object whose removal is undone", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        ObjectEditUtil.openRemoveConfirmPopup(await select(objectId), "Want to remove this label?");
        const popup = popupStateObservable.peek();
        (popup as Extract<typeof popup, {popupType: "confirm"}>).params.onConfirm();
        await settle();
        expect(selectedObjectId()).toBeUndefined();
        expect(selectedQuadIndex()).toBeDefined();

        await ClientEventHistoryUtil.undo();
        await settle();
        expect(selectedObjectId()).toBe(objectId);
        expect(selectedQuadIndex()).toBeUndefined();
    });

    it("moves on to a face near an object that an undo takes away from under it", async () => {
        lookAtTheWall();
        const objectId = await userHangs(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3});
        // Selected again by the user, so not as the hanging left it: an object, with no face noted before it.
        ClientEventHistoryUtil.clear();
        const signal = new AddObjectSignal(room.id, actingUser.id, actingUser.userName, canvasTypeIndex, objectId,
            new ObjectTransform(onWallAt(10.5), SOUTH, {...UNIT_VEC3}));
        RoomEditUtil.record(ClientEventType.ManuallyAddedObject, room,
            {redo: [signal], undo: [new RemoveObjectSignal(room.id, objectId)], selectionBefore: null});

        await ClientEventHistoryUtil.undo();
        await settle();
        expect(selectedObjectId()).toBeUndefined();
        const moved = selectedQuadIndex()!;
        expect(VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, moved)).toBe(true);
    });

    it("is left alone by a step that edit mode ends under, which carries its edit through all the same", async () => {
        const objectId = await standObject(labelTypeIndex, LABEL_POS, LABEL_DIR, {...UNIT_VEC3}, labelled("Library"));
        ObjectEditUtil.openRemoveConfirmPopup(await select(objectId), "Want to remove this label?");
        const popup = popupStateObservable.peek();
        (popup as Extract<typeof popup, {popupType: "confirm"}>).params.onConfirm();
        await settle();
        // The label takes its time coming back.
        let letGo = () => {};
        const held = new Promise<void>(resolve => { letGo = resolve; });
        vi.spyOn(ObjectFactory, "createServerSideObject").mockImplementation(
            params => ({...fakeGameObject(params), onSpawn: () => held}) as unknown as GameObject);

        const undone = ClientEventHistoryUtil.undo();
        await settle();
        GameModeUtil.exitEditMode();
        letGo();

        expect(await undone).toBe("done");
        expect(room.objectById[objectId]).toBeDefined();
        expect(selectedQuadIndex()).toBeUndefined();
        expect(selectedObjectId()).toBeUndefined();
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
    });
});

// ─── Selections made by hand ────────────────────────────────────────────────

describe("a selection the user makes by hand", () => {
    const WALL_FACE = quadIndexOf(WALL_ROW, 10, "z", "+", LAYER + 1);
    const NEXT_WALL_FACE = quadIndexOf(WALL_ROW, 11, "z", "+", LAYER + 1);
    const BUILT_FACE = quadIndexOf(ROW + 1, COL, "z", "+", LAYER);

    const numSelectionsEntered = () =>
        ClientEventHistoryUtil.getNumEventsAfterTime(ClientEventType.ManuallySelectedVoxelQuad, -1) +
        ClientEventHistoryUtil.getNumEventsAfterTime(ClientEventType.ManuallySelectedObject, -1);

    it("is undone by going back to what it left, and redone by taking again what it took", async () => {
        forceSelect(room, SOUTH_FACE);
        userClicksFace(TOP_FACE);
        userClicksFace(WALL_FACE);
        expect(selectedQuadIndex()).toBe(WALL_FACE);

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(selectedQuadIndex()).toBe(TOP_FACE);
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(selectedQuadIndex()).toBe(SOUTH_FACE);
        expect(await ClientEventHistoryUtil.undo()).toBe("none");

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(selectedQuadIndex()).toBe(TOP_FACE);
        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        expect(selectedQuadIndex()).toBe(WALL_FACE);
        expect(await ClientEventHistoryUtil.redo()).toBe("none");

        // Nothing of the room changed, and nothing was sent.
        expect(sentSignals()).toEqual([]);
        expect(ClientEventHistoryUtil.getNumEventsAfterTime(ClientEventType.ManuallySelectedVoxelQuad, -1)).toBe(2);
    });

    it("goes back from an object to the face left for it, and takes the object up again", async () => {
        const objectId = await standObject(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3});
        forceSelect(room, SOUTH_FACE);
        await settle();
        await userClicksObject(objectId);
        expect([selectedObjectId(), selectedQuadIndex()]).toEqual([objectId, undefined]);
        expect(ClientEventHistoryUtil.getNumEventsAfterTime(ClientEventType.ManuallySelectedObject, -1)).toBe(1);

        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        await settle();
        expect([selectedObjectId(), selectedQuadIndex()]).toEqual([undefined, SOUTH_FACE]);

        expect(await ClientEventHistoryUtil.redo()).toBe("done");
        await settle();
        expect([selectedObjectId(), selectedQuadIndex()]).toEqual([objectId, undefined]);
    });

    it("enters nothing for a click on what is selected already", async () => {
        forceSelect(room, SOUTH_FACE);
        userClicksFace(TOP_FACE);
        userClicksFace(TOP_FACE);

        expect(numSelectionsEntered()).toBe(1);
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
    });

    it("enters nothing for a selection the user didn't make: what edit mode opens on, or a tool moves it to", async () => {
        const objectId = await standObject(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3});
        gameModeObservable.set("play");
        GameModeUtil.enterEditMode(ClientObjectManager.getObjectById(objectId)!);
        await settle();
        expect(selectedObjectId()).toBe(objectId);

        expect(VoxelQuadSelection.trySelect(voxelAt(room, ROW, COL), SOUTH_FACE)).toBe(true);
        await settle();
        userAddsBlock();
        expect(selectedQuadIndex()).toBe(BUILT_FACE);

        expect(numSelectionsEntered()).toBe(0);
        // The block put up is all there is to undo.
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(await ClientEventHistoryUtil.undo()).toBe("none");
    });

    it("is undone and redone in its place among the edits made around it", async () => {
        forceSelect(room, SOUTH_FACE);
        userClicksFace(TOP_FACE);
        userPaints(TOP_FACE, 40);
        userClicksFace(SOUTH_FACE);
        userAddsBlock();
        userClicksFace(WALL_FACE);
        const state = () => [selectedQuadIndex(), textureAt(TOP_FACE), shapeAt(ROW + 1, COL)];
        expect(state()).toEqual([WALL_FACE, 40, VOXEL_BLOCK_SHAPE_WHOLE]);

        const undone = [
            [BUILT_FACE, 40, VOXEL_BLOCK_SHAPE_WHOLE],
            [SOUTH_FACE, 40, VOXEL_BLOCK_SHAPE_EMPTY],
            [TOP_FACE, 40, VOXEL_BLOCK_SHAPE_EMPTY],
            [TOP_FACE, TEXTURES[1], VOXEL_BLOCK_SHAPE_EMPTY],
            [SOUTH_FACE, TEXTURES[1], VOXEL_BLOCK_SHAPE_EMPTY],
        ];
        for (const expected of undone)
        {
            expect(await ClientEventHistoryUtil.undo()).toBe("done");
            expect(state()).toEqual(expected);
        }
        expect(await ClientEventHistoryUtil.undo()).toBe("none");

        for (const expected of [...undone.slice(0, -1).reverse(), [WALL_FACE, 40, VOXEL_BLOCK_SHAPE_WHOLE]])
        {
            expect(await ClientEventHistoryUtil.redo()).toBe("done");
            expect(state()).toEqual(expected);
        }
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
    });

    it("ends what could be redone, as an edit does", async () => {
        forceSelect(room, SOUTH_FACE);
        userPaints(SOUTH_FACE, 40);
        await ClientEventHistoryUtil.undo();

        userClicksFace(TOP_FACE);
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(textureAt(SOUTH_FACE)).toBe(TEXTURES[5]);
    });

    it("is passed over where what it left is gone, for the step before it", async () => {
        const objectId = await standObject(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3});
        forceSelect(room, SOUTH_FACE);
        await settle();
        await userClicksObject(objectId);
        userClicksFace(TOP_FACE);
        await settle();
        // Somebody else takes the object down.
        expect(await ClientObjectManager.removeObject(objectId, false)).toBe(true);

        // Not back to the object, then, but to the face selected before it.
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        await settle();
        expect([selectedObjectId(), selectedQuadIndex()]).toEqual([undefined, SOUTH_FACE]);
        expect(await ClientEventHistoryUtil.undo()).toBe("none");

        // Nor forward to it again.
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(selectedQuadIndex()).toBe(SOUTH_FACE);
    });

    it("is passed over where the face it left no longer shows", async () => {
        forceSelect(room, SOUTH_FACE);
        userClicksFace(WALL_FACE);
        // Somebody else builds against the block's south face.
        putBlock(ROW + 1, COL);

        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(selectedQuadIndex()).toBe(WALL_FACE);
    });

    it("is passed over where what it left is selected already", async () => {
        forceSelect(room, SOUTH_FACE);
        userPaints(SOUTH_FACE, 40);
        userClicksFace(TOP_FACE);
        // Something other than the user puts the selection back.
        forceSelect(room, SOUTH_FACE);

        // So the press reaches the edit before it instead of doing nothing.
        expect(await ClientEventHistoryUtil.undo()).toBe("done");
        expect(textureAt(SOUTH_FACE)).toBe(TEXTURES[5]);
    });

    it("comes to nothing in any room but the one it was made in", async () => {
        forceSelect(room, SOUTH_FACE);
        userClicksFace(TOP_FACE);
        const elsewhere = createRoom("another-room");
        VoxelUpdateUtil.addVoxelBlock(undefined, elsewhere.voxelGrid.voxels, TOP_FACE, OTHER_TEXTURES);
        (App.getCurrentRoom as Mock).mockReturnValue(elsewhere);

        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(selectedQuadIndex()).toBe(TOP_FACE);
    });

    it("starts over, with the edits, as edit mode ends", async () => {
        const objectId = await standObject(canvasTypeIndex, onWallAt(10.5), SOUTH, {...UNIT_VEC3});
        forceSelect(room, SOUTH_FACE);
        userClicksFace(TOP_FACE);
        userPaints(TOP_FACE, 40);
        userPaints(TOP_FACE, 41);
        await ClientEventHistoryUtil.undo();

        GameModeUtil.exitEditMode();
        GameModeUtil.enterEditMode(ClientObjectManager.getObjectById(objectId)!);
        await settle();

        expect(await ClientEventHistoryUtil.undo()).toBe("none");
        expect(await ClientEventHistoryUtil.redo()).toBe("none");
        expect(textureAt(TOP_FACE)).toBe(40);
        expect(selectedObjectId()).toBe(objectId);
    });

    describe("by a movement key", () => {
        // What the camera does of a request once it has framed the selection (see PlayerCamera).
        function cameraTakesRequest(): boolean
        {
            const requested = orbitCameraAngleHoldRequestObservable.peek();
            orbitCameraAngleHoldRequestObservable.set(false);
            return requested;
        }

        beforeEach(() => {
            lookAtTheWall();
            forceSelect(room, WALL_FACE);
        });

        it("is undone and redone with the view sliding alongside, as the step had it", async () => {
            expect(SelectionStepUtil.tryStep("right")).toBe(true);
            expect(selectedQuadIndex()).toBe(NEXT_WALL_FACE);
            expect(cameraTakesRequest()).toBe(true);

            expect(await ClientEventHistoryUtil.undo()).toBe("done");
            expect(selectedQuadIndex()).toBe(WALL_FACE);
            expect(cameraTakesRequest()).toBe(true);

            expect(await ClientEventHistoryUtil.redo()).toBe("done");
            expect(selectedQuadIndex()).toBe(NEXT_WALL_FACE);
            expect(cameraTakesRequest()).toBe(true);
        });

        it("asks for no slide where it was made by a click, nor where it is passed over", async () => {
            userClicksFace(NEXT_WALL_FACE);
            expect(await ClientEventHistoryUtil.undo()).toBe("done");
            expect(selectedQuadIndex()).toBe(WALL_FACE);
            expect(cameraTakesRequest()).toBe(false);

            // A step whose place is taken back by something else meanwhile.
            ClientEventHistoryUtil.clear();
            expect(SelectionStepUtil.tryStep("right")).toBe(true);
            cameraTakesRequest();
            forceSelect(room, WALL_FACE);
            expect(await ClientEventHistoryUtil.undo()).toBe("none");
            expect(cameraTakesRequest()).toBe(false);
        });

        it("enters nothing for a key that moves nothing", async () => {
            // Up from the wall's top layer, where the surface runs on only over its top, turned away from the camera.
            forceSelect(room, quadIndexOf(WALL_ROW, 10, "z", "+", LAYER + WALL_LAYERS - 1));
            expect(SelectionStepUtil.tryStep("up")).toBe(false);
            expect(numSelectionsEntered()).toBe(0);
        });
    });
});
