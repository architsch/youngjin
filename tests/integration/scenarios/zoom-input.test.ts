/**
 * Scenario tests: the wheel and the pinch as the camera reads them (PlayerPointerInput + PointerZoomInput)
 * — on the canvas in either mode, and in edit mode over the 2D UI too, except where a scrollable area
 * keeps the wheel, under a popup, and behind the loading indicator — and the scrollable areas themselves
 * (ScrollAreaUtil), a sideways one scrolled by a wheel rolled up or down. The DOM is stood in for.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// A stand-in canvas and window that record their listeners, so events can be fired at them directly.
const canvasListeners: {[type: string]: (ev: any) => void} = {};
const canvas = {
    style: {cursor: ""},
    addEventListener: (type: string, listener: (ev: any) => void) => { canvasListeners[type] = listener; },
    removeEventListener: (type: string) => { delete canvasListeners[type]; },
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600}),
};
const windowListeners: {[type: string]: (ev: any) => void} = {};
vi.stubGlobal("window", {
    addEventListener: (type: string, listener: (ev: any) => void) => { windowListeners[type] = listener; },
    removeEventListener: (type: string) => { delete windowListeners[type]; },
});

// An element as far as scrolling goes: what its style lets it do, and how its contents fit its box.
class FakeElement
{
    parentElement: FakeElement | null = null;
    overflowX = "visible";
    overflowY = "visible";
    scrollWidth = 300;
    clientWidth = 300;
    scrollHeight = 80;
    clientHeight = 80;
    scrollLeft = 0;

    constructor(init: Partial<FakeElement> = {})
    {
        Object.assign(this, init);
    }
}
vi.stubGlobal("Element", FakeElement);
vi.stubGlobal("getComputedStyle", (element: FakeElement) => {
    // As a browser has it.
    if (!(element instanceof FakeElement))
        throw new TypeError("getComputedStyle: parameter 1 is not of type 'Element'.");
    return {overflowX: element.overflowX, overflowY: element.overflowY};
});
vi.stubGlobal("WheelEvent", {DOM_DELTA_PIXEL: 0, DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2});

vi.mock("../../../src/client/graphics/graphicsManager", () => ({
    default: {
        getGameCanvas: () => canvas,
        getGameRenderer: () => ({getSize: (out: any) => out.set(800, 600)}),
    },
}));

vi.mock("../../../src/client/graphics/util/cameraUtil", () => ({
    default: {castFromPointer: vi.fn(() => undefined), getObjectFromIntersection: vi.fn()},
}));

import PlayerPointerInput from "../../../src/client/object/components/helpers/player/playerPointerInput";
import PlayerController from "../../../src/client/object/components/playerController";
import GizmoDragUtil from "../../../src/client/graphics/util/gizmoDragUtil";
import ScrollAreaUtil from "../../../src/client/ui/util/scrollAreaUtil";
import { gameModeObservable, numOpenPopupsObservable } from "../../../src/client/system/clientObservables";
import { endClientProcess, tryStartClientProcess } from "../../../src/client/system/types/clientProcess";

// What one notch of a wheel pushed away scales the view by (see PointerZoomInput).
const ONE_NOTCH_IN = 1.15;
const NOTCH_PX = 100;

/** A row of tiles wider than its box, which scrolls sideways only (e.g. the texture strip). */
function strip(parentElement: FakeElement | null = null): FakeElement
{
    return new FakeElement({parentElement, overflowX: "auto", overflowY: "auto", scrollWidth: 900});
}

/** A column of rows taller than its box, which scrolls up and down only (e.g. a popup's form). */
function list(parentElement: FakeElement | null = null): FakeElement
{
    return new FakeElement({parentElement, overflowY: "auto", scrollHeight: 400});
}

/** Something drawn inside another element, which doesn't scroll itself (a button, a tile). */
function inside(parentElement: FakeElement | null): FakeElement
{
    return new FakeElement({parentElement});
}

// A gizmo occupying the left of the canvas.
const GIZMO_EDGE_X = 100;
const gizmo = {onMove: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn()};
GizmoDragUtil.addSource("zoom-input.test", {
    pick: (ev: PointerEvent) => (ev.clientX < GIZMO_EDGE_X) ? {cursor: "move", begin: () => gizmo} : null,
});

const controller = {dx: 0, dy: 0} as unknown as PlayerController;
let input: PlayerPointerInput;

interface FiredEvent
{
    prevented: boolean;
}

function roll(target: unknown, init: Record<string, unknown> = {}): FiredEvent
{
    const ev = {target, deltaX: 0, deltaY: -NOTCH_PX, deltaMode: 0, ctrlKey: false, prevented: false,
        preventDefault() { this.prevented = true; }, ...init};
    windowListeners["wheel"]?.(ev);
    return ev;
}

// A touch event: every finger now down, as [what it landed on, x, y].
function touch(type: string, fingers: [unknown, number, number][], cancelable: boolean = true): FiredEvent
{
    const ev = {cancelable, prevented: false, preventDefault() { this.prevented = true; },
        touches: fingers.map(([target, clientX, clientY]) => ({target, clientX, clientY}))};
    windowListeners[type](ev);
    return ev;
}

function press(x: number, y: number, pointerId: number = 1): void
{
    canvasListeners["pointerdown"]({pointerId, pointerType: "touch", buttons: 1, clientX: x, clientY: y});
}

function move(x: number, y: number, pointerId: number = 1): void
{
    canvasListeners["pointermove"]({pointerId, pointerType: "touch", buttons: 1, clientX: x, clientY: y});
}

// One frame of input: the view scale the camera would read.
function frameViewScale(): number
{
    input.update(1 / 60, controller);
    return input.viewScale;
}

function frameDragDelta(): {x: number, y: number}
{
    input.update(1 / 60, controller);
    return {x: input.dragDelta.x, y: input.dragDelta.y};
}

beforeEach(() => {
    gizmo.onMove.mockClear();
    gizmo.onCancel.mockClear();
    gameModeObservable.set("edit");
    input = new PlayerPointerInput();
    input.onSpawn(controller);
});

afterEach(() => {
    input.onDespawn(controller);
    gameModeObservable.set("play");
    numOpenPopupsObservable.set(0);
});

describe("a wheel roll", () => {
    it("on the canvas zooms in either mode, and is kept from the page", () => {
        for (const mode of ["play", "edit"] as const)
        {
            gameModeObservable.set(mode);
            const ev = roll(canvas);

            expect(frameViewScale(), mode).toBeCloseTo(ONE_NOTCH_IN, 6);
            expect(ev.prevented, mode).toBe(true);
            expect(frameViewScale(), "asked for once, not every frame after").toBe(1);
        }
    });

    it("over the 2D UI zooms in edit mode", () => {
        const ev = roll(inside(null));

        expect(frameViewScale()).toBeCloseTo(ONE_NOTCH_IN, 6);
        expect(ev.prevented).toBe(true);
    });

    it("over the 2D UI is left alone in play mode", () => {
        gameModeObservable.set("play");
        const ev = roll(inside(null));

        expect(frameViewScale()).toBe(1);
        expect(ev.prevented).toBe(false);
    });

    it("over the 2D UI is left alone under a popup, until the popup is gone", () => {
        numOpenPopupsObservable.set(1);
        const under = roll(inside(null));
        expect(frameViewScale()).toBe(1);
        expect(under.prevented).toBe(false);

        numOpenPopupsObservable.set(0);
        roll(inside(null));
        expect(frameViewScale()).toBeCloseTo(ONE_NOTCH_IN, 6);
    });

    it("over the 2D UI is left alone behind the loading indicator", () => {
        expect(tryStartClientProcess("zoom-input.test", 1, 0)).toBe(true);
        try
        {
            roll(inside(null));
            expect(frameViewScale()).toBe(1);
        }
        finally
        {
            endClientProcess("zoom-input.test");
        }
    });

    it("over a scrollable area is that area's, and never zooms", () => {
        for (const area of [strip(), list()])
        {
            // On the area itself, and on something inside it.
            for (const target of [area, inside(inside(area))])
            {
                const ev = roll(target);
                expect(frameViewScale()).toBe(1);
                expect(ev.prevented, "the camera keeps nothing from the browser there").toBe(false);
            }
        }
    });

    it("over a row that could scroll but has nothing to zooms", () => {
        const fitting = new FakeElement({overflowX: "auto", overflowY: "auto"});
        roll(inside(fitting));

        expect(frameViewScale()).toBeCloseTo(ONE_NOTCH_IN, 6);
    });

    it("with ctrl held, which is a trackpad's pinch, zooms over a scrollable area too", () => {
        const ev = roll(inside(strip()), {ctrlKey: true});

        expect(frameViewScale()).toBeCloseTo(ONE_NOTCH_IN, 6);
        expect(ev.prevented).toBe(true);
    });

    it("zooms by the notch, whatever unit the wheel reports it in", () => {
        // Pulled toward the user, which zooms out.
        for (const init of [{deltaY: NOTCH_PX, deltaMode: 0}, {deltaY: 3, deltaMode: 1}, {deltaY: 1, deltaMode: 2}])
        {
            roll(canvas, init);
            expect(frameViewScale(), JSON.stringify(init)).toBeCloseTo(1 / ONE_NOTCH_IN, 6);
        }
    });
});

describe("a scrollable area", () => {
    it("is the nearest element around the pointer whose contents overflow a way its style scrolls", () => {
        const outer = list();
        const row = strip(outer);
        const tile = inside(row);

        expect(ScrollAreaUtil.find(tile)).toBe(row);
        expect(ScrollAreaUtil.find(row)).toBe(row);
        expect(ScrollAreaUtil.find(tile, "x")).toBe(row);
        expect(ScrollAreaUtil.find(tile, "y"), "past the row, which only scrolls sideways").toBe(outer);
        expect(ScrollAreaUtil.find(inside(outer), "x")).toBeNull();
    });

    it("is not an element whose contents fit, or whose style only clips them", () => {
        const fitting = new FakeElement({overflowX: "auto", overflowY: "auto"});
        const clipped = new FakeElement({overflowX: "hidden", overflowY: "hidden", scrollWidth: 900, scrollHeight: 400});
        const unstyled = new FakeElement({scrollWidth: 900, scrollHeight: 400});

        for (const element of [fitting, clipped, unstyled])
            expect(ScrollAreaUtil.find(inside(element))).toBeNull();
    });

    it("is not an element overflowing by the single pixel a layout's rounding leaves", () => {
        const rounded = new FakeElement({overflowX: "auto", overflowY: "auto", scrollWidth: 301, scrollHeight: 81});
        const real = new FakeElement({overflowX: "scroll", scrollWidth: 302});

        expect(ScrollAreaUtil.find(rounded)).toBeNull();
        expect(ScrollAreaUtil.find(real)).toBe(real);
    });

    it("is none for what is no element at all", () => {
        expect(ScrollAreaUtil.find(null)).toBeNull();
        expect(ScrollAreaUtil.find(canvas as unknown as EventTarget)).toBeNull();
    });
});

describe("a wheel rolled up or down over a strip that only scrolls sideways", () => {
    function rollOver(target: FakeElement, init: Record<string, unknown> = {}): boolean
    {
        return ScrollAreaUtil.tryScrollSideways({target, deltaX: 0, deltaY: NOTCH_PX, deltaMode: 0,
            ctrlKey: false, ...init} as unknown as WheelEvent);
    }

    it("scrolls the strip sideways by the roll, either way", () => {
        const row = strip();
        row.scrollLeft = 200;

        expect(rollOver(inside(row))).toBe(true);
        expect(row.scrollLeft).toBe(200 + NOTCH_PX);

        expect(rollOver(row, {deltaY: -NOTCH_PX})).toBe(true);
        expect(row.scrollLeft).toBe(200);
    });

    it("scrolls it a notch for a notch, whatever unit the wheel reports it in", () => {
        const byLines = strip(), byPages = strip();

        rollOver(byLines, {deltaY: 3, deltaMode: 1});
        expect(byLines.scrollLeft).toBeCloseTo(NOTCH_PX, 6);

        // A page is the strip's own width.
        rollOver(byPages, {deltaY: 1, deltaMode: 2});
        expect(byPages.scrollLeft).toBe(byPages.clientWidth);
    });

    it("is left to the browser where something around the pointer scrolls up and down", () => {
        // A strip inside a scrolling form, and a panel that scrolls both ways.
        const nested = strip(list());
        const bothWays = new FakeElement({overflowX: "auto", overflowY: "auto", scrollWidth: 900, scrollHeight: 400});

        for (const row of [nested, bothWays])
        {
            expect(rollOver(inside(row))).toBe(false);
            expect(row.scrollLeft).toBe(0);
        }
    });

    it("leaves a sideways roll and a trackpad's pinch alone", () => {
        const row = strip();

        expect(rollOver(row, {deltaX: NOTCH_PX, deltaY: 0})).toBe(false);
        expect(rollOver(row, {deltaX: NOTCH_PX, deltaY: NOTCH_PX / 2}), "mostly sideways").toBe(false);
        expect(rollOver(row, {ctrlKey: true})).toBe(false);
        expect(row.scrollLeft).toBe(0);
    });

    it("finds nothing to scroll off a strip", () => {
        expect(rollOver(inside(null))).toBe(false);
        expect(rollOver(inside(list()))).toBe(false);
    });
});

describe("a pinch", () => {
    const button = inside(null);

    it("on the canvas scales the view by how far apart its fingers move, in either mode", () => {
        for (const mode of ["play", "edit"] as const)
        {
            gameModeObservable.set(mode);
            touch("touchstart", [[canvas, 300, 300]]);
            touch("touchstart", [[canvas, 300, 300], [canvas, 400, 300]]);
            expect(frameViewScale(), "landing is no movement").toBe(1);

            touch("touchmove", [[canvas, 250, 300], [canvas, 400, 300]]);
            touch("touchmove", [[canvas, 250, 300], [canvas, 450, 300]]);
            expect(frameViewScale(), mode).toBeCloseTo(2, 6);

            touch("touchmove", [[canvas, 300, 300], [canvas, 400, 300]]);
            expect(frameViewScale(), mode).toBeCloseTo(0.5, 6);
            touch("touchend", []);
        }
    });

    it("in edit mode counts a finger wherever it lands on the 2D UI", () => {
        // One finger on the canvas and one on a button, then both on the UI, one of them in a scrolling row.
        for (const [first, second] of [[canvas, button], [button, inside(strip())]])
        {
            touch("touchstart", [[first, 100, 100]]);
            touch("touchstart", [[first, 100, 100], [second, 100, 300]]);
            touch("touchmove", [[first, 100, 100], [second, 100, 400]]);

            expect(frameViewScale()).toBeCloseTo(1.5, 6);
            touch("touchend", []);
        }
    });

    it("counts no finger on the 2D UI in play mode, under a popup, or behind the loading indicator", () => {
        // The view scale asked for, and whether the fingers' move was kept from the browser.
        const pinchOntoUI = (): {viewScale: number, kept: boolean} => {
            touch("touchstart", [[canvas, 100, 100]]);
            touch("touchstart", [[canvas, 100, 100], [button, 100, 300]]);
            const kept = touch("touchmove", [[canvas, 100, 100], [button, 100, 400]]).prevented;
            touch("touchend", []);
            return {viewScale: frameViewScale(), kept};
        };
        const NO_PINCH = {viewScale: 1, kept: false};

        gameModeObservable.set("play");
        expect(pinchOntoUI(), "play mode").toEqual(NO_PINCH);

        gameModeObservable.set("edit");
        numOpenPopupsObservable.set(1);
        expect(pinchOntoUI(), "under a popup").toEqual(NO_PINCH);
        numOpenPopupsObservable.set(0);

        expect(tryStartClientProcess("zoom-input.test", 1, 0)).toBe(true);
        try
        {
            expect(pinchOntoUI(), "behind the loading indicator").toEqual(NO_PINCH);
        }
        finally
        {
            endClientProcess("zoom-input.test");
        }

        // Edit mode, with nothing in the way.
        const pinch = pinchOntoUI();
        expect(pinch.viewScale).toBeCloseTo(1.5, 6);
        expect(pinch.kept).toBe(true);
    });

    it("keeps its moves from the browser, where the browser lets it", () => {
        touch("touchstart", [[button, 100, 100]]);
        expect(touch("touchmove", [[button, 110, 100]]).prevented, "one finger scrolls and taps as ever").toBe(false);

        touch("touchstart", [[button, 110, 100], [button, 110, 300]]);
        expect(touch("touchmove", [[button, 110, 100], [button, 110, 320]]).prevented).toBe(true);

        // A scroll the browser already has under way can't be stopped: the zoom still follows the fingers.
        frameViewScale();
        const late = touch("touchmove", [[button, 110, 100], [button, 110, 430]], false);
        expect(late.prevented).toBe(false);
        expect(frameViewScale()).toBeCloseTo(1.5, 6);
    });

    it("carries on without a jump when a finger lands or lifts", () => {
        touch("touchstart", [[canvas, 100, 100]]);
        touch("touchstart", [[canvas, 100, 100], [canvas, 100, 200]]);
        touch("touchmove", [[canvas, 100, 100], [canvas, 100, 300]]);
        expect(frameViewScale()).toBeCloseTo(2, 6);

        // A third finger is ignored...
        touch("touchstart", [[canvas, 100, 100], [canvas, 100, 300], [canvas, 500, 500]]);
        touch("touchmove", [[canvas, 100, 100], [canvas, 100, 300], [canvas, 600, 50]]);
        expect(frameViewScale()).toBe(1);

        // ...until the first lifts, which leaves two fingers further apart than the two before them.
        touch("touchend", [[canvas, 100, 300], [canvas, 600, 50]]);
        expect(frameViewScale()).toBe(1);
        const farApart = Math.hypot(500, 250);
        touch("touchmove", [[canvas, 100, 300], [canvas, 600 + 500, 50 - 250]]);
        expect(frameViewScale()).toBeCloseTo(2 * farApart / farApart, 6);
    });

    it("holds the zoom still while its fingers are too close to tell their ratio", () => {
        touch("touchstart", [[canvas, 100, 100]]);
        touch("touchstart", [[canvas, 100, 100], [canvas, 100, 110]]);
        touch("touchmove", [[canvas, 100, 100], [canvas, 100, 120]]);

        expect(frameViewScale()).toBe(1);
    });

    it("takes the drag away from a finger on the canvas, wherever its second finger lands in edit mode", () => {
        press(400, 300);
        touch("touchstart", [[canvas, 400, 300]]);
        frameDragDelta();
        move(430, 300);
        expect(frameDragDelta().x).toBeCloseTo(30);

        touch("touchstart", [[canvas, 430, 300], [button, 100, 500]]);
        move(480, 300);
        expect(frameDragDelta()).toEqual({x: 0, y: 0});

        // Nor does the drag come back once the second finger has lifted.
        touch("touchend", [[canvas, 480, 300]]);
        move(520, 300);
        expect(frameDragDelta()).toEqual({x: 0, y: 0});
    });

    it("takes the drag away whichever of a finger's two events comes first, its press or its touch", () => {
        press(400, 300);
        touch("touchstart", [[canvas, 400, 300]]);
        frameDragDelta();

        // The second finger's touch event, then its press on the canvas.
        touch("touchstart", [[canvas, 400, 300], [canvas, 200, 300]]);
        press(200, 300, 2);
        move(260, 300, 2);
        move(430, 300);

        expect(frameDragDelta()).toEqual({x: 0, y: 0});
    });

    it("takes a gizmo's drag away too", () => {
        press(50, 300);
        touch("touchstart", [[canvas, 50, 300]]);
        expect(GizmoDragUtil.isActive()).toBe(true);

        touch("touchstart", [[canvas, 50, 300], [button, 100, 500]]);

        expect(GizmoDragUtil.isActive()).toBe(false);
        expect(gizmo.onCancel).toHaveBeenCalledOnce();
    });

    it("leaves a finger's drag alone in play mode when another lands on the 2D UI", () => {
        gameModeObservable.set("play");
        press(400, 300);
        touch("touchstart", [[canvas, 400, 300]]);
        frameDragDelta();

        touch("touchstart", [[canvas, 400, 300], [button, 100, 500]]);
        move(430, 300);

        expect(frameDragDelta().x).toBeCloseTo(30);
    });
});
