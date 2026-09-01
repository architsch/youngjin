import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";
import EncodableMap from "../../networking/types/encodableMap";
import EncodableRaw2ByteNumber from "../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import AddObjectSignal from "./addObjectSignal";
import { ObjectMetadata } from "./objectMetadata";
import ObjectTransform from "./objectTransform";
import DoorObjectUtil from "../util/doorObjectUtil";
import { COLLISION_LAYER_MIN, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL,
    INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW } from "../../system/sharedConstants";

let temp_roomID = "";
let temp_participantUserNameByID: { [userID: string]: string } = {};
let temp_sourceVoxelGridVersion = 0;

const latestVersion = 2;

// The voxel-grid format that first stood a room two storeys tall. A room's objects are written in
// the same blob as its voxel grid, so a grid older than this is also objects written while the room
// was half its present height — which is the one thing this format's own version byte cannot say.
//
// It cannot say it because the byte never moved: the object layout did not change when the room's
// height did, only the vertical range positions are measured against (see ObjectTransform), so
// version 0 was written both before that change and after it. The grid beside them is the only
// record of which. That is why the converter below takes the room's word for its age rather than
// this format's own.
const FIRST_TWO_STOREY_VOXEL_GRID_VERSION = 2;

// The voxel-grid format that first filled the entrance doorway back in, which is the same change
// that made a room's own way in a stored object rather than one every client spawned for itself. A
// grid older than this belongs to a room whose door was never written down, and that is what dates
// the objects beside it: a group holding no door is either such a room, or a room whose admin took
// its door away, and only the grid can tell the two apart.
const FIRST_STORED_ENTRANCE_DOOR_VOXEL_GRID_VERSION = 3;

// What a group decoded on its own is dated at. Objects arriving without a grid beside them were
// encoded by a running build rather than read out of storage, so they are current-era by
// construction and need no rescaling. Named as its own thing rather than importing VoxelGrid's
// latest version, which would make these two modules import each other.
const CURRENT_ERA_VOXEL_GRID_VERSION = FIRST_STORED_ENTRANCE_DOOR_VOXEL_GRID_VERSION;

export default class ObjectGroup extends EncodableData
{
    objectById: {[objectId: string]: AddObjectSignal};

    constructor(objects: AddObjectSignal[])
    {
        super();
        this.objectById = {};
        for (const object of objects)
            this.objectById[object.objectId] = object;
    }

    encodeWithParams(bufferState: BufferState, participantUserNameByID: { [userID: string]: string })
    {
        temp_participantUserNameByID = participantUserNameByID;
        this.encode(bufferState);
    }

    encode(bufferState: BufferState)
    {
        new EncodableRawByteNumber(latestVersion).encode(bufferState);
        
        const objects = Object.values(this.objectById);
        const sourceUserIDs: string[] = [];
        const sourceUserNames: string[] = [];
        const objectSourceUserIndices: number[] = [];

        // Determine the objects' source user indices.
        for (let i = 0; i < objects.length; ++i)
        {
            const object = objects[i];
            let userIndex = sourceUserIDs.indexOf(object.sourceUserID);
            if (userIndex < 0)
            {
                sourceUserIDs.push(object.sourceUserID);
                let mostRecentSourceUserName = temp_participantUserNameByID[object.sourceUserID];
                if (mostRecentSourceUserName == undefined)
                    mostRecentSourceUserName = object.sourceUserName; // Fallback to the object's own sourceUserName if the userName is not found among the room's current participants.
                sourceUserNames.push(mostRecentSourceUserName);
                userIndex = sourceUserIDs.length - 1;
            }
            objectSourceUserIndices[i] = userIndex;
        }

        // Encode the number of unique source users, so as to let the decoder know
        // how many subsequent byte-strings will need to be parsed as the
        // sourceUserIDs and sourceUserNames.
        new EncodableRawByteNumber(sourceUserIDs.length).encode(bufferState);

        // Encode the sourceUserIDs and sourceUserNames.
        for (let i = 0; i < sourceUserIDs.length; ++i)
        {
            new EncodableByteString(sourceUserIDs[i]).encode(bufferState);
            new EncodableByteString(sourceUserNames[i]).encode(bufferState);
        }

        // Encode the number of objects, so as to let the decoder know
        // how many objects will need to be decoded.
        if (objects.length > 65535)
            throw new Error(`Number of objects exceeded the maximum value 65535 (objects.length = ${objects.length})`);
        new EncodableRaw2ByteNumber(objects.length).encode(bufferState);

        // Encode the objects.
        for (let i = 0; i < objects.length; ++i)
        {
            const object = objects[i];
            new EncodableRaw2ByteNumber(objectSourceUserIndices[i]).encode(bufferState);
            new EncodableRawByteNumber(object.objectTypeIndex).encode(bufferState);
            new EncodableByteString(object.objectId).encode(bufferState);
            object.transform.encode(bufferState);
            new EncodableMap(object.metadata).encode(bufferState);
        }
    }

    // "sourceVoxelGridVersion" is the version of the voxel grid decoded from the same blob, just
    // before this call. The converters need it to date the objects; see the note on
    // FIRST_TWO_STOREY_VOXEL_GRID_VERSION. A caller with no grid beside these objects — a group
    // encoded on its own, which is always written at the current version — can leave it out.
    static decodeWithParams(bufferState: BufferState, roomID: string,
        sourceVoxelGridVersion: number = CURRENT_ERA_VOXEL_GRID_VERSION): EncodableData
    {
        temp_roomID = roomID;
        temp_sourceVoxelGridVersion = sourceVoxelGridVersion;
        if (!temp_roomID || temp_roomID.length == 0)
            throw new Error("ObjectGroup::decodeWithParams :: temp_roomID is empty.");
        return ObjectGroup.decode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const versionFound = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        if (versionFound < latestVersion)
        {
            let data = olderVersionDecoders[versionFound](bufferState);
            for (let version = versionFound; version < latestVersion; ++version)
                data = versionConverters[version](data);
            return data;
        }

        return decodeBody(bufferState);
    }
}

// The object list itself. Every version so far has written it the same way — what changed between
// them is what the numbers inside it mean — so one reader serves them all.
function decodeBody(bufferState: BufferState): ObjectGroup
{
    const objects: AddObjectSignal[] = [];
    const sourceUserIDs: string[] = [];
    const sourceUserNames: string[] = [];

    // Decode the number of unique source users.
    const numSourceUsers = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
    // Decode the sourceUserIDs and sourceUserNames.
    for (let i = 0; i < numSourceUsers; ++i)
    {
        sourceUserIDs.push((EncodableByteString.decode(bufferState) as EncodableByteString).str);
        sourceUserNames.push((EncodableByteString.decode(bufferState) as EncodableByteString).str);
    }

    // Decode the number of objects.
    const numObjects = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;

    // Decode the objects.
    for (let i = 0; i < numObjects; ++i)
    {
        const userIndex = (EncodableRaw2ByteNumber.decode(bufferState) as EncodableRaw2ByteNumber).n;
        const sourceUserID = sourceUserIDs[userIndex];
        const sourceUserName = sourceUserNames[userIndex];
        const objectTypeIndex = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        const objectId = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const transform = ObjectTransform.decode(bufferState) as ObjectTransform;
        const metadata = (EncodableMap.decodeWithParams(bufferState, EncodableByteString.decode) as EncodableMap).map as ObjectMetadata;

        objects.push(new AddObjectSignal(temp_roomID, sourceUserID, sourceUserName, objectTypeIndex, objectId, transform, metadata));
    }

    return new ObjectGroup(objects);
}

const olderVersionDecoders: ((bufferState: BufferState) => EncodableData)[] = [
    // Every version so far is written byte for byte the way the current one is — what changed
    // between them is what the numbers mean, and what the room is expected to hold — so they are all
    // read by the same reader and corrected afterwards.
    decodeBody,
    decodeBody,
];

const versionConverters: ((olderVersionData: EncodableData) => EncodableData)[] = [
    (olderVersionData: EncodableData) => { // version 0 -> 1
        const objectGroup = olderVersionData as ObjectGroup;

        // Version 0 spans both sides of the change this converts, because the object format's own
        // version byte never moved when the room's height did. The blob's voxel grid is what dates
        // it: a grid from before the room gained its second storey means these objects were placed
        // against a room half as tall, and every height read out of them is twice what was meant.
        //
        // Objects written after that change are already right and must be left alone — halving them
        // would drop every painting in a current room to half its height, which is the same fault
        // over again in the other direction.
        if (temp_sourceVoxelGridVersion >= FIRST_TWO_STOREY_VOXEL_GRID_VERSION)
            return objectGroup;

        for (const object of Object.values(objectGroup.objectById))
        {
            const {pos} = object.transform;
            object.transform.pos = {x: pos.x, y: ObjectTransform.rescaleLegacyY(pos.y), z: pos.z};
        }
        return objectGroup;
    },
    (olderVersionData: EncodableData) => { // version 1 -> 2
        const objectGroup = olderVersionData as ObjectGroup;

        // A room's own way in used to be a door every client spawned for itself and nobody stored,
        // standing over a hole in the boundary wall. Now it is an ordinary object the room holds,
        // and a room that never held one has to be given it — otherwise it comes out with a filled
        // doorway and nothing to open it (the grid beside these objects is filled by the conversion
        // that dates them; see FIRST_STORED_ENTRANCE_DOOR_VOXEL_GRID_VERSION).
        //
        // Rooms written after that change already hold their door, and must be left alone: adding a
        // second one would put a door over a door in every room in the game, and would put back the
        // one an admin had deliberately taken down.
        if (temp_sourceVoxelGridVersion >= FIRST_STORED_ENTRANCE_DOOR_VOXEL_GRID_VERSION)
            return objectGroup;

        const entranceDoor = DoorObjectUtil.makeEntranceDoor(temp_roomID,
            INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_COL, INITIAL_MULTI_PLAYER_ENTRANCE_VOXEL_ROW, COLLISION_LAYER_MIN);
        objectGroup.objectById[entranceDoor.objectId] = entranceDoor;
        return objectGroup;
    },
];