// DOM selectors from views/page/dynamic/mypage.ejs
export const SELECTORS = {
    GAME_CANVAS_ROOT: "#gameCanvasRoot",
    OVERLAY_CANVAS_ROOT: "#overlayCanvasRoot",
    UI_ROOT: "#uiRoot",
    THREE_CANVAS: "#gameCanvasRoot canvas",
} as const;

// Timeouts for specific operations
export const TIMEOUTS = {
    SOCKET_CONNECT: 15_000,
    CANVAS_RENDER: 20_000,
    BUNDLE_LOAD: 15_000,
} as const;
