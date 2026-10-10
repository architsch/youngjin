import App from "../../app";
import Vec3 from "../../../shared/math/types/vec3";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import VolumeObjectTypeConfig from "../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";
import ObjectTagUtil from "../../../shared/object/util/objectTagUtil";
import RoomVolume from "../../../shared/room/types/roomVolume";
import SinglePlayerRoomUtil from "../../../shared/singlePlayer/util/singlePlayerRoomUtil";
import { ZERO_VEC3 } from "../../../shared/system/sharedConstants";

// What has been reported missing, so a step asking every frame says so once.
const reportedMissing = new Set<string>();

// What a mode's steps act on in the room it is played in (see SinglePlayerModeClientConfig): objects by the tags
// its maker gave them, and stretches of it by the names of the volumes marking them. The room comes as a file,
// so a step never knows where anything stands, only what it was called. A thing the room lacks is reported and
// read as nothing, which leaves the step carrying on as well as it can.
const SinglePlayerRoomQueryUtil =
{
    // "" with no such object.
    getTaggedObjectId: (tag: string): string =>
    {
        return findTaggedObject(tag)?.objectId ?? "";
    },
    // The room's corner with no such object.
    getTaggedObjectPos: (tag: string): Vec3 =>
    {
        return findTaggedObject(tag)?.transform.pos ?? ZERO_VEC3;
    },
    // The blocks a volume marks (see VolumeObjectTypeConfig).
    getVolume: (name: string): RoomVolume | undefined =>
    {
        const room = App.getCurrentRoom();
        const volume = room ? VolumeObjectTypeConfig.util.findByName(room, name) : undefined;
        if (!volume)
            reportMissing(`volume "${name}"`);
        return volume && VolumeObjectTypeConfig.util.getRoomVolume(volume.transform);
    },
    // Where the player was put down (see SinglePlayerRoomUtil).
    getPlayerStartPos: (): Vec3 =>
    {
        const room = App.getCurrentRoom();
        return room ? SinglePlayerRoomUtil.getPlayerStartPos(room) : ZERO_VEC3;
    },
}

function findTaggedObject(tag: string): AddObjectSignal | undefined
{
    const room = App.getCurrentRoom();
    const object = room ? ObjectTagUtil.findObject(room, tag) : undefined;
    if (!object)
        reportMissing(`object tagged "${tag}"`);
    return object;
}

function reportMissing(what: string): void
{
    const roomName = App.getCurrentRoom()?.roomName ?? "";
    const key = `${roomName}/${what}`;
    if (reportedMissing.has(key))
        return;
    reportedMissing.add(key);
    console.error(`SinglePlayerRoomQueryUtil :: The room has no ${what} (roomName = ${roomName})`);
}

export default SinglePlayerRoomQueryUtil;
