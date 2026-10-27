import Vec3 from "../../../shared/math/types/vec3";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import EncodableByteString from "../../../shared/networking/types/encodableByteString";
import ImageMap from "../../../shared/graphics/image/types/imageMap";
import ImageMetadata from "../../../shared/graphics/image/types/imageMetadata";
import ImageMapUtil from "../../../shared/graphics/image/util/imageMapUtil";
import PictureSearchUtil from "../../../shared/graphics/image/util/pictureSearchUtil";
import PreEncodedCompositionIndexMap from "../../../shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import CompositionMetadataUtil from "../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import ObjectCategoryConfigMap from "../../../shared/object/maps/objectCategoryConfigMap";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { DoorTypeEnumMap } from "../../../shared/object/types/doorType";
import { ObjectMetadata } from "../../../shared/object/types/objectMetadata";
import { ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import CanvasObjectTypeConfig, {
    CANVAS_IMAGE_SUBFOLDER } from "../../../shared/object/types/objectTypeConfig/canvasObjectTypeConfig";
import DoorObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import FanObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/fanObjectTypeConfig";
import LampObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/lampObjectTypeConfig";
import MirrorObjectTypeConfig, {
    MIRROR_COLOR_PALETTE_NAME } from "../../../shared/object/types/objectTypeConfig/mirrorObjectTypeConfig";
import ColorUtil from "../../../shared/math/util/colorUtil";
import PropObjectTypeConfig, {
    PROP_IMAGE_SUBFOLDER } from "../../../shared/object/types/objectTypeConfig/propObjectTypeConfig";
import VolumeObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import RemoveObjectSignal from "../../../shared/object/types/removeObjectSignal";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import SetObjectTransformSignal from "../../../shared/object/types/setObjectTransformSignal";
import LabelTextUtil from "../../../shared/object/util/labelTextUtil";
import HelperBehaviorUtil from "../../../shared/object/util/helperBehaviorUtil";
import ObjectAttachmentUtil from "../../../shared/object/util/objectAttachmentUtil";
import ObjectIdUtil from "../../../shared/object/util/objectIdUtil";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import ObjectUpdateUtil from "../../../shared/object/util/objectUpdateUtil";
import QuarterTurnsUtil from "../../../shared/object/util/quarterTurnsUtil";
import Room from "../../../shared/room/types/room";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import { HUB_ROOM_ID_KEYWORD, OBJECT_USER_NAME_MAX_LENGTH, UNIT_VEC3, VOXEL_CELL_SIZE,
    ZONE_USER_NAME_FOR_NOBODY } from "../../../shared/system/sharedConstants";
import User from "../../../shared/user/types/user";
import RestrictedZoneUtil from "../../../shared/voxel/util/restrictedZoneUtil";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";
import StringUtil from "../../../shared/math/util/stringUtil";
import DBRoomUtil from "../../db/util/dbRoomUtil";
import ServerRoomManager from "../../room/serverRoomManager";
import { AGENT_LOOK_MAX_OBJECTS, IS_PUBLIC_SITE } from "../../system/serverConstants";
import AgentBudgetUtil from "./agentBudgetUtil";
import AgentBox from "../types/agentBox";
import AgentFace from "../types/agentFace";
import AgentObjectEdit from "../types/agentObjectEdit";
import AgentObjectRequest from "../types/agentObjectRequest";
import { AgentSide } from "../types/agentSide";
import AgentUserContext from "../types/agentUserContext";
import AgentGridUtil from "./agentGridUtil";
import AgentRoomUtil from "./agentRoomUtil";
import AgentSignalUtil from "./agentSignalUtil";

const NOT_IN_A_ROOM = "You aren't in a room.";
const NOTHING_BY_THAT_ID = "Nothing by that id is here (look lists what is).";
const STILL_NPC_NOTE = "A character nobody plays, named by its text: it stands still and says nothing.";
const MIRROR_ADMIN_NOTE = "Only an admin changes one.";

// What agents may add, by the names they give the types. NPCs, with how a helper is played (its BehaviorPrefs), and
// mirrors are an admin's alone (see NpcObjectTypeConfig, MirrorObjectTypeConfig), and no agent is one.
const ADDABLE_OBJECT_TYPES = ["Canvas", "Prop", "Lamp", "Fan", "Label", "Door"];
// The types whose look is chosen, by its number among their pre-encoded looks (a lamp's follows its size).
const LOOK_CHOOSING_OBJECT_TYPES = ["Canvas", "Label", "Door"];

// The picture map's subfolder of each kind of picture.
const PICTURE_SUBFOLDERS: {[kind: string]: string} = {painting: CANVAS_IMAGE_SUBFOLDER, object: PROP_IMAGE_SUBFOLDER};

// What a new label says until it is written on, as a browser's (see ObjectPlacementUtil).
const NEW_LABEL_TEXT = "Label";
const NEW_ZONE_NAME = "zone";

// How many of a picture's keywords describe it, which come first.
const PICTURE_DESCRIPTION_WORDS = 3;

const doorTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
const npcTypeIndex = ObjectTypeConfigMap.getIndexByType("Npc");
const mirrorTypeIndex = ObjectTypeConfigMap.getIndexByType("Mirror");

// What an agent places and arranges: canvases, props, lamps, fans, and (in a room of its own) labels, doors and
// restricted zones. Each change is sent as the signal a browser sends for a person's, so it passes the same checks
// (see ObjectUpdateUtil); what they would refuse is refused here first, saying why.
const AgentObjectUtil =
{
    addableTypes: ADDABLE_OBJECT_TYPES.map(objectType => objectType.toLowerCase()),

    // The room's placed objects nearest a point, its doors, zones and helpers apart (look lists those). An NPC nobody
    // plays (an Idle one) is no helper, so it is one of them.
    describeObjects: (room: Room, from: Vec3): {objects: object[], more?: number} =>
    {
        const listed = Object.values(room.objectById)
            .filter(obj => isAttached(obj) && obj.objectTypeIndex != doorTypeIndex
                && !(obj.objectTypeIndex == npcTypeIndex && HelperBehaviorUtil.isPlayed(obj)))
            .map(obj => ({obj, distance: Vector3DUtil.distSqr(from, obj.transform.pos)}))
            .sort((a, b) => a.distance - b.distance);
        const shown = listed.slice(0, AGENT_LOOK_MAX_OBJECTS);
        return {objects: shown.map(({obj}) => describeObject(obj)),
            more: (listed.length > shown.length) ? listed.length - shown.length : undefined};
    },
    // The room's restricted zones, and whether the user may build in each.
    describeZones: (room: Room, user: User): object[] =>
    {
        return RestrictedZoneUtil.getZones(room).map(zone => describeZone(room, user, zone));
    },
    // Pictures to hang, whose words hold every word given: paintings (for a canvas) and everyday objects (for a prop).
    findPictures: (words: string, kind: string | undefined, count: number): object =>
    {
        const imageMap = ImageMapUtil.getImageMap("PictureImageMap");
        const kinds = (kind != undefined) ? [kind] : Object.keys(PICTURE_SUBFOLDERS);
        const offered = kinds.flatMap(k => getOfferedPictures(imageMap, k).map(image => ({kind: k, image})));
        const found = PictureSearchUtil.filter(offered, words, ({image}) => image.keywords ?? "");
        return {
            pictures: found.slice(0, count).map(({kind, image}) => ({
                id: image.path,
                kind,
                about: describePicture(image.keywords),
                // In blocks; a painting is fitted to its canvas instead.
                size: (kind == "object") ? toBlockSize(PropObjectTypeConfig.util.getImageScale(image.path, 0)) : undefined,
            })),
            found: found.length,
            note: (found.length == 0) ? "No picture matched: try fewer or other words." : undefined,
        };
    },
    addObject: async (ctx: AgentUserContext, request: AgentObjectRequest): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const objectType = ADDABLE_OBJECT_TYPES.find(objectType => objectType.toLowerCase() == request.type);
        if (objectType == undefined)
            return {error: `Only ${AgentObjectUtil.addableTypes.join(", ")} can be added.`};
        const objectTypeIndex = ObjectTypeConfigMap.getIndexByType(objectType);
        const user = ctx.user;
        const spent = AgentBudgetUtil.describeSpentEdits(ctx.user.id, 1);
        if (spent != undefined)
            return {error: spent};

        if ((objectType == "Door" || objectType == "Label") && !RoomValidationUtil.isRoomSuperuser(user, room))
            return {error: "Only a room's owner places doors and labels in it (in a hub, nobody may). Your own room is "
                + "yours: travel home."};
        const full = describeFull(room, objectTypeIndex);
        if (full != undefined)
            return {error: full};

        const quadIndex = AgentGridUtil.getFaceQuadIndex(request.on);
        if (quadIndex < 0 || !VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
            return {error: describeHiddenFace(request.on)};
        const {center, dir} = AgentGridUtil.getFaceCenter(room.voxelGrid.voxels, quadIndex);
        if (!ObjectAttachmentUtil.allowsFacing(objectTypeIndex, dir))
            return {error: `A ${request.type} hangs only on a wall: a north, south, east or west side.`};

        const made = await makeContent(ctx, room, objectType, request, dir);
        if ("error" in made)
            return made;

        const objectId = makeObjectId(room);
        const accepts = (transform: ObjectTransform) => ObjectUpdateUtil.canAddObject(user, room,
            new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId, transform, made.metadata));
        const transform = findTransform(room, objectTypeIndex, quadIndex, center, dir, made.scale, accepts);
        if (transform == undefined)
            return {error: describeNoPlace(room, user, objectTypeIndex, center, dir, made.scale)};

        await AgentSignalUtil.send(ctx, "addObjectSignal",
            new AddObjectSignal(room.id, user.id, user.userName, objectTypeIndex, objectId, transform, made.metadata));
        const added = room.objectById[objectId];
        return (added != undefined) ? {added: describeObject(added)} : {error: "It couldn't be added there."};
    },
    editObject: async (ctx: AgentUserContext, edit: AgentObjectEdit): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const obj = room.objectById[edit.id];
        if (obj == undefined || !isEditable(obj))
            return {error: NOTHING_BY_THAT_ID};
        const objectType = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).objectType;
        const typeName = objectType.toLowerCase();
        // Said before a door's destination is looked up (see describeUntouchable); the checks below have the last word.
        if (["Door", "Label", "Volume"].includes(objectType) && !RoomValidationUtil.isRoomSuperuser(ctx.user, room)
            && !RoomValidationUtil.userIsAdmin(ctx.user))
        {
            return {error: describeUntouchable(room, ctx.user, obj, "changes")};
        }
        if (objectType == "Mirror" && !RoomValidationUtil.userIsAdmin(ctx.user))
            return {error: describeUntouchable(room, ctx.user, obj, "changes")};

        const changes: {key: number, value: string}[] = [];
        const refuse = (field: string) => ({error: `A ${typeName} has no ${field} to change.`});
        if (edit.text != undefined)
        {
            if (objectType != "Label" && objectType != "Door")
                return refuse("text");
            changes.push({key: ObjectMetadataKeyEnumMap.Label, value: edit.text});
        }
        if (edit.picture != undefined)
        {
            if (objectType == "Prop")
                return {error: "A prop is as large as its picture, so its picture stays: remove it and add another."};
            if (objectType != "Canvas")
                return refuse("picture");
            const problem = describeBadPicture(edit.picture, "painting");
            if (problem != undefined)
                return {error: problem};
            changes.push({key: ObjectMetadataKeyEnumMap.ImagePath, value: edit.picture});
        }
        if (edit.look != undefined)
        {
            const look = getLook(objectType, edit.look);
            if (look == undefined)
                return {error: describeLooks(objectType)};
            changes.push({key: ObjectMetadataKeyEnumMap.InstancedMeshComposition, value: look});
        }
        if (edit.destination != undefined)
        {
            if (objectType != "Door")
                return refuse("destination");
            const destination = await resolveDestination(ctx, room, edit.destination);
            if ("error" in destination)
                return destination;
            changes.push({key: ObjectMetadataKeyEnumMap.DestinationRoomId, value: destination.roomID});
        }
        if (edit.arriveAt != undefined)
        {
            if (objectType != "Door")
                return refuse("door to arrive at");
            changes.push({key: ObjectMetadataKeyEnumMap.DestinationDoorLabel, value: edit.arriveAt});
        }
        if (edit.keepFor != undefined || edit.name != undefined)
        {
            if (objectType != "Volume")
                return refuse((edit.keepFor != undefined) ? "keeper" : "name");
            const zone = describeBadZone(edit.keepFor ?? VolumeObjectTypeConfig.util.getZoneUserName(obj),
                edit.name ?? VolumeObjectTypeConfig.util.getName(obj));
            if (zone != undefined)
                return {error: zone};
            if (edit.keepFor != undefined)
                changes.push({key: ObjectMetadataKeyEnumMap.ZoneUserName, value: edit.keepFor});
            if (edit.name != undefined)
                changes.push({key: ObjectMetadataKeyEnumMap.Label, value: edit.name});
        }
        if (changes.length == 0)
            return {error: "Give something to change."};

        const signals = changes.map(({key, value}) => new SetObjectMetadataSignal(room.id, obj.objectId, key, value));
        if (!signals.every(signal => ObjectUpdateUtil.canSetObjectMetadata(ctx.user, room, signal)))
            return {error: describeUntouchable(room, ctx.user, obj, "changes")};
        const spent = AgentBudgetUtil.describeSpentEdits(ctx.user.id, signals.length);
        if (spent != undefined)
            return {error: spent};
        for (const signal of signals)
            await AgentSignalUtil.send(ctx, "setObjectMetadataSignal", signal);
        return (objectType == "Volume") ? {edited: describeZone(room, ctx.user, obj)} : {edited: describeObject(obj)};
    },
    // Rehangs it on another face, at the size it is. A picture on a floor or ceiling turns its top toward the side
    // given (north if none); on a wall it is upright.
    moveObject: async (ctx: AgentUserContext, objectId: string, on: AgentFace, top?: AgentSide): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const obj = room.objectById[objectId];
        if (obj == undefined || !isEditable(obj))
            return {error: NOTHING_BY_THAT_ID};
        if (!isAttached(obj))
            return {error: "A zone is moved by removing it and adding another."};
        const user = ctx.user;
        const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
        if (!config.canUserSetObjectTransform(user, room, obj,
            new SetObjectTransformSignal(room.id, objectId, obj.transform, true))
            || RestrictedZoneUtil.blocksObjectEdit(user, room, obj.objectTypeIndex, obj.transform))
        {
            return {error: describeUntouchable(room, user, obj, "moves")};
        }

        const quadIndex = AgentGridUtil.getFaceQuadIndex(on);
        if (quadIndex < 0 || !VoxelQueryUtil.isVoxelQuadVisible(room.voxelGrid.voxels, quadIndex))
            return {error: describeHiddenFace(on)};
        const {center, dir} = AgentGridUtil.getFaceCenter(room.voxelGrid.voxels, quadIndex);
        if (!ObjectAttachmentUtil.allowsFacing(obj.objectTypeIndex, dir))
            return {error: `A ${config.objectType.toLowerCase()} hangs only on a wall: a north, south, east or west side.`};

        // A picture is turned to suit the face it goes on, which changes a prop's shape as it changes its turn.
        const hasTurns = obj.metadata[ObjectMetadataKeyEnumMap.QuarterTurns] != undefined;
        const turns = hasTurns ? getQuarterTurns(dir, top) : 0;
        const turnsChange = hasTurns && turns != QuarterTurnsUtil.getQuarterTurns(obj);
        const imagePath = obj.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str ?? "";
        const scale = (config.objectType == "Prop")
            ? PropObjectTypeConfig.util.getImageScale(imagePath, turns) ?? obj.transform.scale
            : ObjectScaleUtil.sanitize(obj.objectTypeIndex, obj.transform.scale);
        const signalFor = (transform: ObjectTransform) => turnsChange
            ? new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.QuarterTurns,
                QuarterTurnsUtil.encode(turns), transform)
            : new SetObjectTransformSignal(room.id, objectId, transform, true);
        const accepts = (transform: ObjectTransform) => {
            const signal = signalFor(transform);
            return (signal instanceof SetObjectMetadataSignal) ? ObjectUpdateUtil.canSetObjectMetadata(user, room, signal)
                : ObjectUpdateUtil.canSetObjectTransform(user, room, signal);
        };
        const transform = findTransform(room, obj.objectTypeIndex, quadIndex, center, dir, scale, accepts);
        if (transform == undefined)
            return {error: describeNoPlace(room, user, obj.objectTypeIndex, center, dir, scale)};
        const spent = AgentBudgetUtil.describeSpentEdits(ctx.user.id, 1);
        if (spent != undefined)
            return {error: spent};

        const signal = signalFor(transform);
        await AgentSignalUtil.send(ctx, (signal instanceof SetObjectMetadataSignal)
            ? "setObjectMetadataSignal" : "setObjectTransformSignal", signal);
        return {moved: describeObject(obj)};
    },
    removeObject: async (ctx: AgentUserContext, objectId: string): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const obj = room.objectById[objectId];
        if (obj == undefined || !isEditable(obj))
            return {error: NOTHING_BY_THAT_ID};
        const signal = new RemoveObjectSignal(room.id, objectId);
        if (!ObjectUpdateUtil.canRemoveObject(ctx.user, room, signal))
            return {error: describeUntouchable(room, ctx.user, obj, "removes")};
        const spent = AgentBudgetUtil.describeSpentEdits(ctx.user.id, 1);
        if (spent != undefined)
            return {error: spent};

        await AgentSignalUtil.send(ctx, "removeObjectSignal", signal);
        return (room.objectById[objectId] == undefined) ? {removed: objectId} : {error: "It couldn't be removed."};
    },
    // A restricted zone over a box of the room, kept for one user, or for nobody but the room's owner (the default).
    addZone: async (ctx: AgentUserContext, box: AgentBox, keepFor: string = ZONE_USER_NAME_FOR_NOBODY,
        name: string = NEW_ZONE_NAME): Promise<object> =>
    {
        const room = AgentRoomUtil.getCurrentRoom(ctx);
        if (room == undefined)
            return {error: NOT_IN_A_ROOM};
        const user = ctx.user;
        if (!RoomValidationUtil.userIsAdmin(user) && !RoomValidationUtil.isRoomSuperuser(user, room))
            return {error: "Only a room's owner makes zones in it. Your own room is yours: travel home."};
        const volumeTypeIndex = ObjectTypeConfigMap.getIndexByType(VolumeObjectTypeConfig.objectType);
        const full = describeFull(room, volumeTypeIndex);
        if (full != undefined)
            return {error: full};
        const volume = AgentGridUtil.toRoomVolume(box);
        if (typeof volume == "string")
            return {error: volume};
        const problem = describeBadZone(keepFor, name);
        if (problem != undefined)
            return {error: problem};

        const objectId = makeObjectId(room);
        const signal = new AddObjectSignal(room.id, user.id, user.userName, volumeTypeIndex, objectId,
            VolumeObjectTypeConfig.util.makeTransformOfRoomVolume(volume), toMetadata({
                [ObjectMetadataKeyEnumMap.Label]: name,
                [ObjectMetadataKeyEnumMap.ZoneUserName]: keepFor,
            }));
        if (!ObjectUpdateUtil.canAddObject(user, room, signal))
            return {error: "The zone couldn't be made."};
        const spent = AgentBudgetUtil.describeSpentEdits(ctx.user.id, 1);
        if (spent != undefined)
            return {error: spent};
        await AgentSignalUtil.send(ctx, "addObjectSignal", signal);
        const zone = room.objectById[objectId];
        return (zone != undefined) ? {added: describeZone(room, user, zone)} : {error: "The zone couldn't be made."};
    },
}

// What it is, where it hangs (the block it lies on, and that block's side) and how large it is.
function describeObject(obj: AddObjectSignal): object
{
    const config = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex);
    const transform = ObjectAttachmentUtil.quantize(obj.objectTypeIndex, obj.transform);
    const imagePath = obj.metadata[ObjectMetadataKeyEnumMap.ImagePath]?.str;
    const text = LabelTextUtil.getText(obj);
    const image = (imagePath != undefined && ImageMapUtil.getImageMap("PictureImageMap").hasImagePath(imagePath))
        ? ImageMapUtil.getImageMap("PictureImageMap").getImageMetadataByPath(imagePath) : undefined;
    return {
        id: obj.objectId,
        type: config.objectType.toLowerCase(),
        on: AgentGridUtil.getFaceBehind(transform.pos, transform.dir),
        size: toBlockSize(ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, transform.scale)),
        picture: imagePath,
        shows: image ? describePicture(image.keywords) : undefined,
        text: (text.length > 0) ? text : undefined,
        look: getLookNumber(obj),
        by: (obj.sourceUserName.length > 0) ? obj.sourceUserName : undefined,
        note: (obj.objectTypeIndex == npcTypeIndex) ? STILL_NPC_NOTE
            : (obj.objectTypeIndex == mirrorTypeIndex) ? describeMirror(obj) : undefined,
    };
}

// What a mirror shows, through its surface's color as far as that is opaque (see MirrorObjectTypeConfig).
function describeMirror(obj: AddObjectSignal): string
{
    const percent = Math.round(100 * MirrorObjectTypeConfig.util.getOpacity(obj));
    const color = ColorUtil.rgbToHex(ColorUtil.paletteIndexToRGB(MIRROR_COLOR_PALETTE_NAME,
        MirrorObjectTypeConfig.util.getColorIndex(obj)));
    if (percent <= 0)
        return `A mirror: it shows the room in front of it reflected, people too. ${MIRROR_ADMIN_NOTE}`;
    if (percent >= 100)
        return `A mirror covered over in ${color}: it shows no reflection. ${MIRROR_ADMIN_NOTE}`;
    return `A mirror tinted ${color}, ${percent}% opaque: it shows the room in front of it reflected through the `
        + `tint, people too. ${MIRROR_ADMIN_NOTE}`;
}

function describeZone(room: Room, user: User, zone: AddObjectSignal): object
{
    const keptFor = VolumeObjectTypeConfig.util.getZoneUserName(zone);
    return {
        id: zone.objectId,
        name: VolumeObjectTypeConfig.util.getName(zone),
        ...AgentGridUtil.fromRoomVolume(VolumeObjectTypeConfig.util.getRoomVolume(zone.transform)),
        keptFor,
        youMayBuild: RoomValidationUtil.isRoomSuperuser(user, room)
            || (keptFor != ZONE_USER_NAME_FOR_NOBODY && keptFor == user.userName),
    };
}

// A picture's first few keywords, its categories aside: a painting's title and painter, an object's name.
function describePicture(keywords: string | undefined): string
{
    return (keywords ?? "").split(",").filter(word => word.length > 0 && !word.endsWith(ImageMap.CATEGORY_MARK))
        .slice(0, PICTURE_DESCRIPTION_WORDS).join(", ");
}

// The pictures of a kind a chooser offers, in its order: staging ones only off the live server (see ImageChoiceUtil).
function getOfferedPictures(imageMap: ImageMap, kind: string): ImageMetadata[]
{
    return imageMap.getImageMetadataListInSubfolder(PICTURE_SUBFOLDERS[kind])
        .filter(image => !IS_PUBLIC_SITE || !image.staging)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function describeBadPicture(imagePath: string | undefined, kind: string): string | undefined
{
    if (imagePath == undefined || imagePath.length == 0)
        return `It needs a picture: find_pictures finds ${(kind == "painting") ? "paintings" : "objects"}.`;
    if (!getOfferedPictures(ImageMapUtil.getImageMap("PictureImageMap"), kind).some(image => image.path == imagePath))
        return `"${imagePath}" isn't one of the ${(kind == "painting") ? "paintings" : "objects"} find_pictures finds.`;
    return undefined;
}

// A size in blocks, from one in world units (its width along the face, then its height).
function toBlockSize(size: Vec3 | undefined): number[] | undefined
{
    return size && [size.x / VOXEL_CELL_SIZE, size.y / VOXEL_CELL_SIZE];
}

// The look of a type numbered as its looks are (see PreEncodedCompositionIndexMap), stored as its metadata is.
function getLook(objectType: string, look: number): string | undefined
{
    const compositionIndices = getLookCompositionIndices(objectType);
    if (!Number.isInteger(look) || look < 0 || look >= compositionIndices.length)
        return undefined;
    return CompositionMetadataUtil.encodeIndexed(compositionIndices[look], ObjectTypeConfigMap.getConfigByIndex(
        ObjectTypeConfigMap.getIndexByType(objectType)).components.spawnedByAny!.instancedMeshComposer!.codecVersion);
}

function getLookNumber(obj: AddObjectSignal): number | undefined
{
    const objectType = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).objectType;
    const stored = obj.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition]?.str;
    const look = getLookCompositionIndices(objectType).findIndex((_, look) => getLook(objectType, look) == stored);
    return (look >= 0) ? look : undefined;
}

function getLookCompositionIndices(objectType: string): number[]
{
    return LOOK_CHOOSING_OBJECT_TYPES.includes(objectType) ? (PreEncodedCompositionIndexMap[objectType] ?? []) : [];
}

function describeLooks(objectType: string): string
{
    const numLooks = getLookCompositionIndices(objectType).length;
    return (numLooks > 0) ? `A ${objectType.toLowerCase()}'s look is a number from 0 to ${numLooks - 1}.`
        : `A ${objectType.toLowerCase()} has no looks to choose from.`;
}

// The turn that shows a picture upright on a wall, or with its top toward a side on a floor or ceiling.
function getQuarterTurns(dir: Vec3, top: AgentSide | undefined): number
{
    if (dir.y == 0)
        return 0;
    const wanted = AgentGridUtil.getSideDir((top != undefined && top != "up" && top != "down") ? top : "north");
    for (let turns = 0; turns < 4; ++turns)
    {
        if (Vector3DUtil.equal(QuarterTurnsUtil.getContentUp(dir, turns), wanted))
            return turns;
    }
    return 0;
}

// The metadata a new object of the type starts with, as a browser's would (see ObjectPlacementUtil), and its scale
// where that is decided by more than room (a picture's, or the size asked for).
async function makeContent(ctx: AgentUserContext, room: Room, objectType: string, request: AgentObjectRequest,
    dir: Vec3): Promise<{metadata: ObjectMetadata, scale: Vec3 | undefined} | {error: string}>
{
    const objectTypeIndex = ObjectTypeConfigMap.getIndexByType(objectType);
    const sized = getRequestedScale(objectTypeIndex, request);
    if (typeof sized == "string")
        return {error: sized};
    const turns = getQuarterTurns(dir, request.top);
    const look = (request.look != undefined) ? getLook(objectType, request.look) : undefined;
    if (request.look != undefined && look == undefined)
        return {error: describeLooks(objectType)};

    switch (objectType)
    {
        case "Canvas":
        {
            const problem = describeBadPicture(request.picture, "painting");
            if (problem != undefined)
                return {error: problem};
            return {scale: sized, metadata: toMetadata({
                [ObjectMetadataKeyEnumMap.ImagePath]: request.picture!,
                // Frameless unless a frame is asked for, as a canvas added by hand is.
                [ObjectMetadataKeyEnumMap.InstancedMeshComposition]: look ?? CanvasObjectTypeConfig.util.getFramelessLook(),
                [ObjectMetadataKeyEnumMap.QuarterTurns]: QuarterTurnsUtil.encode(turns),
            })};
        }
        case "Prop":
        {
            const problem = describeBadPicture(request.picture, "object");
            if (problem != undefined)
                return {error: problem};
            return {scale: PropObjectTypeConfig.util.getImageScale(request.picture!, turns), metadata: toMetadata({
                [ObjectMetadataKeyEnumMap.ImagePath]: request.picture!,
                [ObjectMetadataKeyEnumMap.QuarterTurns]: QuarterTurnsUtil.encode(turns),
            })};
        }
        case "Lamp":
            return {scale: sized, metadata: toMetadata({
                [ObjectMetadataKeyEnumMap.LightProperties]: LampObjectTypeConfig.util.getDefaultLightProperties(),
            })};
        case "Fan":
            return {scale: undefined, metadata: toMetadata({
                [ObjectMetadataKeyEnumMap.ForceProperties]: FanObjectTypeConfig.util.getDefaultForceProperties(),
                [ObjectMetadataKeyEnumMap.FanColor]: FanObjectTypeConfig.util.getDefaultColor(),
            })};
        case "Label":
            return {scale: sized, metadata: toMetadata({
                [ObjectMetadataKeyEnumMap.Label]: request.text ?? NEW_LABEL_TEXT,
                ...((look != undefined) ? {[ObjectMetadataKeyEnumMap.InstancedMeshComposition]: look} : {}),
            })};
        case "Door":
        {
            const destination = await resolveDestination(ctx, room, request.destination ?? "");
            if ("error" in destination)
                return destination;
            // Never a room's default entrance, as a door added by hand isn't until it is made one.
            return {scale: undefined, metadata: toMetadata({
                [ObjectMetadataKeyEnumMap.DoorType]: `${DoorTypeEnumMap.CustomEntrance}`,
                [ObjectMetadataKeyEnumMap.DestinationRoomId]: destination.roomID,
                ...((request.text != undefined) ? {[ObjectMetadataKeyEnumMap.Label]: request.text} : {}),
                ...((request.arriveAt != undefined)
                    ? {[ObjectMetadataKeyEnumMap.DestinationDoorLabel]: request.arriveAt} : {}),
                ...((look != undefined) ? {[ObjectMetadataKeyEnumMap.InstancedMeshComposition]: look} : {}),
            })};
        }
        default:
            return {error: `Only ${AgentObjectUtil.addableTypes.join(", ")} can be added.`};
    }
}

// The scale of the size asked for, in blocks (a side not given is as long as the other); undefined if none was, or
// what is wrong with it.
function getRequestedScale(objectTypeIndex: number, request: AgentObjectRequest): Vec3 | undefined | string
{
    if (request.width == undefined && request.height == undefined)
        return undefined;
    const config = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
    const base = config.components.spawnedByAny?.collider?.baseHitboxSize;
    if (config.scaling?.getFixedScale != undefined)
        return `A ${config.objectType.toLowerCase()} is as large as its picture: leave out width and height.`;
    if (config.scaling == undefined || base == undefined)
        return `A ${config.objectType.toLowerCase()} comes in one size: leave out width and height.`;

    const width = request.width ?? request.height!;
    const height = request.height ?? request.width!;
    const scale = {x: width * VOXEL_CELL_SIZE / base.sizeX, y: height * VOXEL_CELL_SIZE / base.sizeY,
        z: config.scaling.minScale.z};
    const sanitized = ObjectScaleUtil.sanitize(objectTypeIndex, scale);
    if (sanitized.x == scale.x && sanitized.y == scale.y)
        return sanitized;
    const min = toBlockSize(ObjectScaleUtil.getObjectSize(objectTypeIndex, config.scaling.minScale))!;
    const max = toBlockSize(ObjectScaleUtil.getObjectSize(objectTypeIndex, config.scaling.maxScale))!;
    return `A ${config.objectType.toLowerCase()} is from ${min[0]} to ${max[0]} blocks wide and from ${min[1]} to `
        + `${max[1]} high, in whole blocks.`;
}

// "hub", "home" (the agent's own room), or a room by its id or link, which must exist; "" leads nowhere (locked).
async function resolveDestination(ctx: AgentUserContext, room: Room,
    destination: string): Promise<{roomID: string} | {error: string}>
{
    const target = destination.trim();
    if (target.length == 0)
        return {roomID: ""};
    if (target.toLowerCase() == HUB_ROOM_ID_KEYWORD)
        return {roomID: HUB_ROOM_ID_KEYWORD};
    const roomID = (target.toLowerCase() == "home") ? ctx.user.ownedRoomID : AgentRoomUtil.parseRoomID(target);
    if (roomID == undefined || roomID.length == 0)
        return {error: `A door leads to "hub", "home" (once you have a room), or a room's id or link, not "${destination}".`};
    if (roomID == room.id)
        return {error: "A door can't lead into the room it is in."};
    if (ServerRoomManager.roomRuntimeMemories[roomID] == undefined && await DBRoomUtil.getDBRoom(roomID) == null)
        return {error: `There is no room ${roomID}.`};
    return {roomID};
}

function describeBadZone(keepFor: string, name: string): string | undefined
{
    const keeper = keepFor.trim();
    if (keeper.length == 0 || StringUtil.truncateByCodePoints(keeper, OBJECT_USER_NAME_MAX_LENGTH) != keeper)
        return `A zone is kept for someone's name, or "${ZONE_USER_NAME_FOR_NOBODY}" for nobody but the room's owner.`;
    if (!LabelTextUtil.isShortName(name))
        return "A zone's name is a few words at most.";
    return undefined;
}

function toMetadata(values: {[key: number]: string}): ObjectMetadata
{
    const metadata: ObjectMetadata = {};
    for (const [key, value] of Object.entries(values))
        metadata[Number(key)] = new EncodableByteString(value);
    return metadata;
}

// Where an object of the type, at the scale given (or the type's default for where it goes), hangs on a face: as near
// its middle as it can.
function findTransform(room: Room, objectTypeIndex: number, quadIndex: number, center: Vec3, dir: Vec3,
    scale: Vec3 | undefined, accepts: (transform: ObjectTransform) => boolean): ObjectTransform | undefined
{
    // Doors stand on their storey's floor, not wherever there is room (as a browser places them).
    if (objectTypeIndex == doorTypeIndex)
    {
        const y = DoorObjectTypeConfig.util.getOriginYOnWall(quadIndex);
        const transform = (y != undefined) ? new ObjectTransform({...center, y}, {...dir}, {...UNIT_VEC3}) : undefined;
        return (transform != undefined && accepts(transform)) ? transform : undefined;
    }
    const place = (placedScale: Vec3) => ObjectAttachmentUtil.findPlacement(room, objectTypeIndex, center, dir,
        placedScale, accepts);
    return place(scale ?? ObjectScaleUtil.getDefaultScale(objectTypeIndex, fitting => place(fitting) != undefined));
}

function describeNoPlace(room: Room, user: User, objectTypeIndex: number, center: Vec3, dir: Vec3,
    scale: Vec3 | undefined): string
{
    if (RestrictedZoneUtil.blocksObjectEdit(user, room, objectTypeIndex,
        new ObjectTransform(center, dir, scale ?? {...UNIT_VEC3})))
    {
        return "A restricted zone covers that spot (look lists the zones).";
    }
    if (objectTypeIndex == doorTypeIndex)
        return "A door needs a stretch of wall 3 blocks wide and a storey high there, standing on the storey's floor, "
            + "open in front and with nothing else hanging on it.";
    return "There is no room for it on that face: something else hangs there, or the face is too small.";
}

function describeHiddenFace(face: AgentFace): string
{
    return `The ${face.side} side of the cell at row ${face.row}, column ${face.column}, layer ${face.layer} doesn't show: `
        + "there is no block there, or another block covers that side (the floor is layer -1's up side).";
}

function describeFull(room: Room, objectTypeIndex: number): string | undefined
{
    const config = ObjectTypeConfigMap.getConfigByIndex(objectTypeIndex);
    const maxCountPerRoom = ObjectCategoryConfigMap.getConfig(config.category).maxCountPerRoom;
    return (maxCountPerRoom != undefined && room.objectGroup.getCategoryCount(config.category) >= maxCountPerRoom)
        ? `This room already holds as many of those as it may (${maxCountPerRoom}).` : undefined;
}

// Why the user may not change an object: who it belongs to, or a zone over it.
function describeUntouchable(room: Room, user: User, obj: AddObjectSignal, change: string): string
{
    const objectType = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).objectType;
    if ((objectType == "Door" || objectType == "Label" || objectType == "Volume")
        && !RoomValidationUtil.isRoomSuperuser(user, room))
    {
        return `Only the room's owner ${change} its doors, labels and zones.`;
    }
    if (objectType == "Mirror" && !RoomValidationUtil.userIsAdmin(user))
        return `Only an admin ${change} a mirror.`;
    if (RestrictedZoneUtil.blocksObjectEdit(user, room, obj.objectTypeIndex, obj.transform))
        return "A restricted zone covers it (look lists the zones).";
    return "That can't be done to it.";
}

function makeObjectId(room: Room): string
{
    let objectId = ObjectIdUtil.generateRandomObjectId();
    while (room.objectById[objectId] != undefined)
        objectId = ObjectIdUtil.generateRandomObjectId();
    return objectId;
}

// Hung on a face (a canvas, prop, lamp, fan, label, door, NPC or mirror), rather than a player, a zone or the room's
// blocks.
function isAttached(obj: AddObjectSignal): boolean
{
    return ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex).attachment != undefined;
}

// What the object tools act on: anything placed, zones included.
function isEditable(obj: AddObjectSignal): boolean
{
    return isAttached(obj) || ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex) == VolumeObjectTypeConfig;
}

export default AgentObjectUtil;
