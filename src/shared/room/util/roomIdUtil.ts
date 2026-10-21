// Firestore document ids: exactly 20 letters and digits, as every stored room's id is, and no single-player mode's (see
// SinglePlayerModeConfigMap).
const ROOM_ID_PATTERN = /^[A-Za-z0-9]{20}$/;

const RoomIdUtil =
{
    isRoomID: (text: string): boolean =>
    {
        return ROOM_ID_PATTERN.test(text);
    },
}

export default RoomIdUtil;
