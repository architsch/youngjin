// A persisted, denormalized editor entry on DBRoom.editors. userName and email are
// copied at the time a user is appointed so that listing editors does not require N
// user lookups. The product invariant is that a user's userName/email never change
// after account creation, so this snapshot does not drift.
//
// This is the DB/server-internal shape — it carries userID (needed to find/remove an
// entry) and an index signature (required so DBColumnType's `Array<{[key: string]: string}>`
// case accepts a `DBRoomEditor[]`). The client-facing projection is the trimmed
// `RoomEditor` ({userName, email}) in shared/user/types — the room router maps between
// the two at the API boundary.
export default interface DBRoomEditor
{
    [field: string]: string;
    userID: string;
    userName: string;
    email: string;
}
