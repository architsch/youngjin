type UserRoomChangeResult =
    | {type: "success", newRoomID: string | undefined}
    | {type: "rejected", reason: "roomIsFull" | "unknownReason"}
    | {type: "error"}

export default UserRoomChangeResult;