// What a user asked for on connecting, for the first room picked (see RoomPickerUtil.pickBestRoomID). Client
// supplied, so untrusted.
export default interface UserJoinHints
{
    targetRoomID?: string;
    // The connection came back to a client still in the room editor.
    roomEditorOpen?: boolean;
}
