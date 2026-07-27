// DOM selectors from views/page/dynamic/mypage.ejs
export const SELECTORS = {
    GAME_CANVAS_ROOT: "#gameCanvasRoot",
    OVERLAY_CANVAS_ROOT: "#overlayCanvasRoot",
    UI_ROOT: "#uiRoot",
    THREE_CANVAS: "#gameCanvasRoot canvas",
} as const;

// Text of the full-screen indicator shown while a blocking client process (e.g. a room
// change) is in flight. See src/client/ui/components/overlay/loading.tsx.
export const LOADING_INDICATOR_TEXT = "Loading...";

// Timeouts for specific operations
export const TIMEOUTS = {
    SOCKET_CONNECT: 15_000,
    CANVAS_RENDER: 20_000,
    BUNDLE_LOAD: 15_000,
    // Entering a room involves a socket round-trip plus the room's content transfer.
    ROOM_LOAD: 30_000,
} as const;
