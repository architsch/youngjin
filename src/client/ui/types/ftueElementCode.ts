export type FTUEElementCode = number;

// Codes are positions in the stored character mapping (see FTUEUtil), so they're permanent; retired
// codes leave a gap.
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