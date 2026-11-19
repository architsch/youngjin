// What the server makes of a player's moves so far in a room (see PlayerMotionCheckUtil).
type PlayerMotionState = {
    roomID: string,
    // When the last move was noted.
    at: number,
    // How far across the room they may still go unexplained, in world units.
    allowance: number,
    // Whether a stream reached them at the last move.
    forced: boolean,
    // How high their feet were, and when, as something last held them up.
    heldFeetY: number,
    heldAt: number,
    distrustedUntil: number,
};

export default PlayerMotionState;
