import ObjectRuntimeMemory from "../../object/types/objectRuntimeMemory";
import Room from "../types/room";

export default interface RoomRuntimeMemory
{
    room: Room;
    participantUserNames: { [userName: string]: boolean };
    objectRuntimeMemories: {[objectId: string]: ObjectRuntimeMemory};
}