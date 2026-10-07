/**
 * Helpers for driving gizmo drags as the player does: a camera looking at the room, and presses, drags and
 * releases at points of the world as that camera shows them, sent through the same arbitration the canvas
 * uses (see GizmoDragUtil). The test must stub graphicsManager (with a real camera and a canvas that has a
 * bounding rect) BEFORE importing this.
 */
import * as THREE from "three";
import GraphicsManager from "../../../src/client/graphics/graphicsManager";
import GizmoDragUtil from "../../../src/client/graphics/util/gizmoDragUtil";
import PointerCoordUtil from "../../../src/client/graphics/util/pointerCoordUtil";
import Vec3 from "../../../src/shared/math/types/vec3";

export interface ScreenPoint
{
    x: number;
    y: number;
}

const worldTemp = new THREE.Vector3();
const screenTemp = new THREE.Vector2();

/** Stands the camera somewhere, looking at a point. */
export function placeCamera(from: Vec3, lookingAt: Vec3): void
{
    const camera = GraphicsManager.getCamera();
    camera.position.set(from.x, from.y, from.z);
    camera.lookAt(lookingAt.x, lookingAt.y, lookingAt.z);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
}

/** Where a point of the world shows on screen, which has to be in front of the camera. */
export function screenPointOf(world: Vec3): ScreenPoint
{
    const screen = PointerCoordUtil.worldToClient(worldTemp.set(world.x, world.y, world.z), screenTemp);
    if (screen == null)
        throw new Error(`The point (${world.x}, ${world.y}, ${world.z}) is behind the camera`);
    return {x: screen.x, y: screen.y};
}

export function pointerAt(point: ScreenPoint, pointerType: string = "mouse"): PointerEvent
{
    return {pointerId: 1, pointerType, clientX: point.x, clientY: point.y} as unknown as PointerEvent;
}

/** Presses the pointer down; returns whether a gizmo took the press (rather than the camera). */
export function press(at: ScreenPoint, pointerType: string = "mouse"): boolean
{
    return GizmoDragUtil.tryBegin(pointerAt(at, pointerType));
}

/** Moves the held pointer through the given points, in order. */
export function dragThrough(...points: ScreenPoint[]): void
{
    for (const point of points)
        GizmoDragUtil.move(pointerAt(point));
}

export function release(): void
{
    GizmoDragUtil.end();
}

/** One whole gesture: a press, a drag through the given points, and a release. Returns whether a gizmo took it. */
export function drag(from: ScreenPoint, ...through: ScreenPoint[]): boolean
{
    if (!press(from))
        return false;
    dragThrough(...through);
    release();
    return true;
}

/** What hovering there would show a press to take hold of ("" for nothing). */
export function cursorAt(point: ScreenPoint): string
{
    GizmoDragUtil.hover(pointerAt(point));
    return GraphicsManager.getGameCanvas().style.cursor;
}
