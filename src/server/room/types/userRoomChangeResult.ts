import { RoomChangeRejectionReason } from "../../../shared/room/types/roomChangeRejectionReason";

type UserRoomChangeResult =
    | {type: "success", newRoomID: string | undefined}
    | {type: "rejected", reason: RoomChangeRejectionReason}
    | {type: "error"}

export default UserRoomChangeResult;
