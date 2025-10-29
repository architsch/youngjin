import ObjectRuntimeMemory from "../object/objectRuntimeMemory";
import Room from "./room";

export default interface RoomRuntimeMemory
{
    room: Room;
    participantUserNames: { [userName: string]: boolean };
    objectRuntimeMemories: {[objectId: string]: ObjectRuntimeMemory};
}