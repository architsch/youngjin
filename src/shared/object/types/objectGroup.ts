import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";
import EncodableMap from "../../networking/types/encodableMap";
import EncodableRaw2ByteNumber from "../../networking/types/encodableRaw2ByteNumber";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import AddObjectSignal from "./addObjectSignal";
import { ObjectMetadata } from "./objectMetadata";
import ObjectTransform from "./objectTransform";
import ObjectGroupVersionMigration, { CURRENT_ERA_VOXEL_GRID_VERSION }
    from "../versionMigration/objectGroupVersionMigration";

let temp_roomID = "";
let temp_participantUserNameByID: { [userID: string]: string } = {};
let temp_sourceVoxelGridVersion = 0;

const latestVersion = 3;

export default class ObjectGroup extends EncodableData
{
    objectById: {[objectId: string]: AddObjectSignal};
    // The format the group was decoded from; older ones were converted (see ObjectGroupVersionMigration).
    sourceFormatVersion: number = latestVersion;

    constructor(objects: AddObjectSignal[])
    {
        super();
        this.objectById = {};
        for (const object of objects)
            this.objectById[object.objectId] = object;
    }

    static get latestFormatVersion(): number { return latestVersion; }

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

        // Number of unique source users (so the decoder knows how many id/name strings follow).
        new EncodableRawByteNumber(sourceUserIDs.length).encode(bufferState);

        // Encode the sourceUserIDs and sourceUserNames.
        for (let i = 0; i < sourceUserIDs.length; ++i)
        {
            new EncodableByteString(sourceUserIDs[i]).encode(bufferState);
            new EncodableByteString(sourceUserNames[i]).encode(bufferState);
        }

        // Object count, for the decoder.
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

    // sourceVoxelGridVersion: the version of the grid decoded from the same blob, used to date the
    // objects (see ObjectGroupVersionMigration). Omit for standalone (current) groups.
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
        const objectGroup = decodeBody(bufferState);
        if (versionFound < latestVersion)
        {
            ObjectGroupVersionMigration.convert(objectGroup, versionFound, latestVersion, temp_roomID,
                temp_sourceVoxelGridVersion);
        }
        objectGroup.sourceFormatVersion = versionFound;
        return objectGroup;
    }
}

// All versions share one body layout (only the meaning of values changed).
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
