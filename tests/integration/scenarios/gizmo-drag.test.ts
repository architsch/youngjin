/**
 * Canvas pointer arbitration between gizmo drags and the camera (PlayerPointerInput + GizmoDragUtil):
 * a press a gizmo takes never turns the view or reads as a tap on the world, the gizmo is fed the
 * pointer only once it is a drag, and everything else reaches the camera as before.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// A stand-in canvas that records its listeners, so events can be fired at them directly.
const canvasListeners: {[type: string]: (ev: any) => void} = {};
const canvas = {
    style: {cursor: ""},
    addEventListener: (type: string, listener: (ev: any) => void) => { canvasListeners[type] = listener; },
    removeEventListener: (type: string) => { delete canvasListeners[type]; },
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600}),
};

vi.mock("../../../src/client/graphics/graphicsManager", () => ({
    default: {
        getGameCanvas: () => canvas,
        getGameRenderer: () => ({getSize: (out: any) => out.set(800, 600)}),
    },
}));

// What a tap on the world would do; watched to see whether one got through.
vi.mock("../../../src/client/graphics/util/cameraUtil", () => ({
    default: {castFromPointer: vi.fn(() => undefined), getObjectFromIntersection: vi.fn()},
}));

import PlayerPointerInput from "../../../src/client/object/components/helpers/player/playerPointerInput";
import PlayerController from "../../../src/client/object/components/playerController";
import GizmoDragUtil from "../../../src/client/graphics/util/gizmoDragUtil";
import CameraUtil from "../../../src/client/graphics/util/cameraUtil";
import { MOUSE_DRAG_THRESHOLD_PX } from "../../../src/client/system/clientConstants";

// A gizmo occupying the left of the canvas.
const GIZMO_EDGE_X = 100;
const handler = {onMove: vi.fn(), onEnd: vi.fn(), onCancel: vi.fn()};
GizmoDragUtil.addSource("gizmo-drag.test", {
    pick: (ev: PointerEvent) => (ev.clientX < GIZMO_EDGE_X) ? {cursor: "move", begin: () => handler} : null,
});

const controller = {dx: 0, dy: 0} as unknown as PlayerController;
let input: PlayerPointerInput;

function fire(type: string, x: number, y: number, init: Record<string, unknown> = {}): void
{
    canvasListeners[type]({pointerId: 1, pointerType: "mouse", buttons: 0, clientX: x, clientY: y,
        preventDefault: () => {}, ...init});
}

// One frame of input: what the camera would read as the drag.
function frameDragDelta(): {x: number, y: number}
{
    input.update(1 / 60, controller);
    return {x: input.dragDelta.x, y: input.dragDelta.y};
}

beforeEach(() => {
    handler.onMove.mockClear();
    handler.onEnd.mockClear();
    handler.onCancel.mockClear();
    vi.mocked(CameraUtil.castFromPointer).mockClear();
    input = new PlayerPointerInput();
    input.onSpawn(controller);
});

afterEach(() => {
    input.onDespawn(controller);
});

describe("a press on a gizmo", () => {
    it("is the gizmo's drag: the view never turns, and the gizmo is fed the pointer once it's a drag", () => {
        fire("pointerdown", 50, 300, {buttons: 1});
        frameDragDelta();

        // Within a tap's tolerance nothing moves yet...
        fire("pointermove", 50 + MOUSE_DRAG_THRESHOLD_PX, 300, {buttons: 1});
        expect(handler.onMove).not.toHaveBeenCalled();

        // ...and past it the gizmo has the pointer, not the camera.
        fire("pointermove", 90, 300, {buttons: 1});
        expect(handler.onMove).toHaveBeenCalled();
        expect(frameDragDelta()).toEqual({x: 0, y: 0});

        fire("pointerup", 90, 300);
        expect(handler.onEnd).toHaveBeenCalledOnce();
        expect(handler.onCancel).not.toHaveBeenCalled();
    });

    it("that never becomes a drag is cancelled, and its click never reaches the world", () => {
        fire("pointerdown", 50, 300, {buttons: 1});
        fire("pointerup", 50, 300);
        fire("click", 50, 300);

        expect(handler.onCancel).toHaveBeenCalledOnce();
        expect(handler.onEnd).not.toHaveBeenCalled();
        expect(CameraUtil.castFromPointer).not.toHaveBeenCalled();
    });

    it("is taken away by a second finger, which pinches instead", () => {
        fire("pointerdown", 50, 300, {pointerType: "touch", buttons: 1});
        fire("pointerdown", 400, 300, {pointerType: "touch", pointerId: 2, buttons: 1});

        expect(handler.onCancel).toHaveBeenCalledOnce();
        expect(GizmoDragUtil.isActive()).toBe(false);
    });

    it("is abandoned when the canvas loses focus mid-drag", () => {
        fire("pointerdown", 50, 300, {buttons: 1});
        fire("pointermove", 90, 300, {buttons: 1});
        canvasListeners["blur"]({});

        expect(handler.onCancel).toHaveBeenCalledOnce();
        expect(handler.onEnd).not.toHaveBeenCalled();
    });
});

describe("a press anywhere else", () => {
    it("turns the view as before", () => {
        fire("pointerdown", 400, 300, {buttons: 1});
        frameDragDelta();
        fire("pointermove", 430, 300, {buttons: 1});

        expect(frameDragDelta().x).toBeCloseTo(30);
        expect(handler.onMove).not.toHaveBeenCalled();
        fire("pointerup", 430, 300);
    });

    it("clicks the world when it doesn't move", () => {
        fire("pointerdown", 400, 300, {buttons: 1});
        fire("pointerup", 400, 300);
        fire("click", 400, 300);

        expect(CameraUtil.castFromPointer).toHaveBeenCalledOnce();
    });
});

describe("hovering", () => {
    it("shows what a press would take hold of, and nothing where it would take nothing", () => {
        fire("pointermove", 50, 300);
        expect(canvas.style.cursor).toBe("move");

        fire("pointermove", 400, 300);
        expect(canvas.style.cursor).toBe("");
    });
});
