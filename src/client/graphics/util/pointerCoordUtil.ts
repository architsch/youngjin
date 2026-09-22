import * as THREE from "three";
import GraphicsManager from "../graphicsManager";

const canvasSizeTemp: THREE.Vector2 = new THREE.Vector2();
const projectionTemp: THREE.Vector3 = new THREE.Vector3();

// Conversions between canvas NDC (for raycasts) and CSS pixels (for pointer travel).

const PointerCoordUtil =
{
    // NDC = Normalized Device Coordinates (with respect to the game canvas)
    getNDC: (ev: PointerEvent, outVec: THREE.Vector2): THREE.Vector2 =>
    {
        const rect = GraphicsManager.getGameCanvas().getBoundingClientRect();
        outVec.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        outVec.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        return outVec;
    },

    // Where a world point shows on screen, in the viewport coordinates pointer events carry. Null behind
    // (or exactly at) the camera, where the projection means nothing.
    worldToClient: (worldPosition: THREE.Vector3, outVec: THREE.Vector2): THREE.Vector2 | null =>
    {
        projectionTemp.copy(worldPosition).project(GraphicsManager.getCamera());
        if (projectionTemp.z > 1 || !Number.isFinite(projectionTemp.x) || !Number.isFinite(projectionTemp.y))
            return null;

        const rect = GraphicsManager.getGameCanvas().getBoundingClientRect();
        outVec.x = rect.left + ((projectionTemp.x + 1) / 2) * rect.width;
        outVec.y = rect.top + ((1 - projectionTemp.y) / 2) * rect.height;
        return outVec;
    },

    // NDC axes are normalized per canvas edge, so scale by half the canvas size to get CSS pixels.
    getPixelOffset: (fromPos: THREE.Vector2, toPos: THREE.Vector2, outVec: THREE.Vector2): THREE.Vector2 =>
    {
        GraphicsManager.getGameRenderer().getSize(canvasSizeTemp);
        return outVec.subVectors(toPos, fromPos).multiply(canvasSizeTemp).multiplyScalar(0.5);
    },
};

export default PointerCoordUtil;
