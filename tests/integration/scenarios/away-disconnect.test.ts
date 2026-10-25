/**
 * Scenario tests: a page left hidden lets go of its connection (see AwayDisconnectUtil). Away is hidden alone: a page
 * in sight is never disconnected, focused or not, nor one hidden for less than the delay, nor one in a single-player
 * room. A page disconnected while away is connected again when it is shown, and not before.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RoomTypeEnumMap } from "../../../src/shared/room/types/roomType";
import { AWAY_DISCONNECT_DELAY_MS } from "../../../src/shared/system/sharedConstants";

// The page as the browser reports it, and the room the client is in.
const page = vi.hoisted(() => ({
    visibilityState: "visible",
    focused: true,
    roomType: 0,
    documentListeners: {} as {[event: string]: (() => void)[]},
    windowListeners: {} as {[event: string]: (() => void)[]},
}));

vi.mock("../../../src/client/networking/client/socketsClient", () => ({
    default: { disconnect: vi.fn(), connect: vi.fn() },
}));

vi.mock("../../../src/client/app", () => ({
    default: { getCurrentRoom: () => ({ roomType: page.roomType }) },
}));

let SocketsClient: { disconnect: ReturnType<typeof vi.fn>, connect: ReturnType<typeof vi.fn> };

/** Brings the page up as the client does, with a fresh AwayDisconnectUtil. */
async function load(visibilityState: "visible" | "hidden"): Promise<void>
{
    page.visibilityState = visibilityState;
    vi.resetModules();
    SocketsClient = (await import("../../../src/client/networking/client/socketsClient")).default as any;
    (await import("../../../src/client/system/util/awayDisconnectUtil")).default.install();
}

function fire(listeners: {[event: string]: (() => void)[]}, event: string): void
{
    for (const listener of listeners[event] ?? [])
        listener();
}

/** Another tab brought in front, or the window minimized. */
function hide(): void
{
    page.visibilityState = "hidden";
    fire(page.documentListeners, "visibilitychange");
}

function show(): void
{
    page.visibilityState = "visible";
    fire(page.documentListeners, "visibilitychange");
}

/** Another window focused, with this one still in sight. */
function focusElsewhere(): void
{
    page.focused = false;
    fire(page.windowListeners, "blur");
    fire(page.documentListeners, "focusout");
}

beforeEach(() => {
    vi.useFakeTimers();
    // The mocked modules outlive vi.resetModules, calls and all.
    vi.clearAllMocks();
    page.focused = true;
    page.roomType = RoomTypeEnumMap.Hub;
    page.documentListeners = {};
    page.windowListeners = {};
    vi.stubGlobal("document", {
        get visibilityState() { return page.visibilityState; },
        get hidden() { return page.visibilityState == "hidden"; },
        hasFocus: () => page.focused,
        addEventListener: (event: string, listener: () => void) => { (page.documentListeners[event] ??= []).push(listener); },
        removeEventListener: () => {},
    });
    vi.stubGlobal("window", {
        addEventListener: (event: string, listener: () => void) => { (page.windowListeners[event] ??= []).push(listener); },
        removeEventListener: () => {},
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("a page left hidden", () => {
    it("is disconnected once hidden for the delay, and connected again only when shown", async () => {
        await load("visible");
        hide();
        vi.advanceTimersByTime(AWAY_DISCONNECT_DELAY_MS - 1);
        expect(SocketsClient.disconnect).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(SocketsClient.disconnect).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(3 * AWAY_DISCONNECT_DELAY_MS);
        expect(SocketsClient.disconnect).toHaveBeenCalledTimes(1);
        expect(SocketsClient.connect).not.toHaveBeenCalled();

        show();
        expect(SocketsClient.connect).toHaveBeenCalledTimes(1);
        // Once taken up again, there is nothing more to take up.
        hide();
        show();
        expect(SocketsClient.connect).toHaveBeenCalledTimes(1);
    });

    it("is never away while in sight, however long another window has the focus", async () => {
        await load("visible");
        focusElsewhere();
        vi.advanceTimersByTime(3 * AWAY_DISCONNECT_DELAY_MS);
        expect(SocketsClient.disconnect).not.toHaveBeenCalled();
    });

    it("keeps its connection when shown within the delay, which counts afresh from its next hiding", async () => {
        await load("visible");
        hide();
        vi.advanceTimersByTime(AWAY_DISCONNECT_DELAY_MS - 1000);
        show();
        hide();
        vi.advanceTimersByTime(AWAY_DISCONNECT_DELAY_MS - 1000);
        expect(SocketsClient.disconnect).not.toHaveBeenCalled();
        expect(SocketsClient.connect).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);
        expect(SocketsClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it("is hidden from the start when opened in the background", async () => {
        await load("hidden");
        vi.advanceTimersByTime(AWAY_DISCONNECT_DELAY_MS);
        expect(SocketsClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it("keeps its connection in a single-player room, however long it is hidden", async () => {
        page.roomType = RoomTypeEnumMap.SinglePlayer;
        await load("visible");
        hide();
        vi.advanceTimersByTime(3 * AWAY_DISCONNECT_DELAY_MS);
        expect(SocketsClient.disconnect).not.toHaveBeenCalled();

        show();
        expect(SocketsClient.connect).not.toHaveBeenCalled();
    });
});
