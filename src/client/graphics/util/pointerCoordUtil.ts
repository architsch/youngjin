import * as THREE from "three";
import GraphicsManager from "../graphicsManager";

const canvasSizeTemp: THREE.Vector2 = new THREE.Vector2();

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

    // NDC axes are normalized per canvas edge, so scale by half the canvas size to get CSS pixels.
    getPixelOffset: (fromPos: THREE.Vector2, toPos: THREE.Vector2, outVec: THREE.Vector2): THREE.Vector2 =>
    {
        GraphicsManager.getGameRenderer().getSize(canvasSizeTemp);
        return outVec.subVectors(toPos, fromPos).multiply(canvasSizeTemp).multiplyScalar(0.5);
    },
};

export default PointerCoordUtil;
