export type FTUEElementCode = number;

// Each code is a position in the character mapping FTUEUtil stores the user's record with, so a
// code is permanent once users have it stored. A retired element therefore leaves its slot behind
// rather than closing it up: reusing the number would hand one feature's stored record to another.
export const FTUEElementCodeEnumMap: Record<string, number> =
{
    CustomizePlayer: 0, // retired: the button it stood for gave way to the one that starts edit mode
    _NOT_USED_: 1,
    EnterMyRoom: 2,
    MyRoomSettings: 3,
    AddCanvas: 4, // retired: Showing a coach mark for this feels annoying
    ChangeCanvasImage: 5, // retired: Showing a coach mark for this feels annoying
    ChangeCanvasFrame: 6, // retired: Showing a coach mark for this feels annoying
    EnterHub: 7,
}