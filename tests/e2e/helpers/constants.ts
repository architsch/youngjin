// DOM selectors from views/page/dynamic/mypage.ejs
export const SELECTORS = {
    GAME_CANVAS_ROOT: "#gameCanvasRoot",
    OVERLAY_CANVAS_ROOT: "#overlayCanvasRoot",
    UI_ROOT: "#uiRoot",
    THREE_CANVAS: "#gameCanvasRoot canvas",
} as const;

// Text of the full-screen indicator shown while a blocking client process (e.g. a room
// change) is in flight. See src/client/ui/components/overlay/loading.tsx.
//
// The page carries a boot-time indicator of its own bearing this same text, deliberately, so that
// it and the app's can swap places unnoticed. Match this text only within the app's UI root, then,
// so that a wait on the app's indicator can never be answered by the page's stand-in for it.
export const LOADING_INDICATOR_TEXT = "Loading...";

// Timeouts for specific operations
export const TIMEOUTS = {
    SOCKET_CONNECT: 15_000,
    CANVAS_RENDER: 20_000,
    BUNDLE_LOAD: 15_000,
    // Entering a room involves a socket round-trip plus the room's content transfer.
    ROOM_LOAD: 30_000,
} as const;
