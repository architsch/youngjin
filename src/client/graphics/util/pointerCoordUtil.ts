import * as THREE from "three";
import GraphicsManager from "../graphicsManager";

const canvasSizeTemp: THREE.Vector2 = new THREE.Vector2();

//------------------------------------------------------------------------
// Conversions between the two units pointer input is worked with in: the game canvas' normalized
// device coordinates (NDC), which is what a raycast into the scene takes, and CSS pixels, which is
// what every measurement of pointer travel is made in.
//------------------------------------------------------------------------

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

    // Pointer positions are captured in NDC, where each axis is normalized by its own edge of the
    // canvas — so on a canvas that is not square, the same NDC distance means different amounts of
    // travel on the two axes. Scaling by half the canvas size (half, because NDC spans -1..1 across
    // a full edge) recovers CSS pixels.
    getPixelOffset: (fromPos: THREE.Vector2, toPos: THREE.Vector2, outVec: THREE.Vector2): THREE.Vector2 =>
    {
        GraphicsManager.getGameRenderer().getSize(canvasSizeTemp);
        return outVec.subVectors(toPos, fromPos).multiply(canvasSizeTemp).multiplyScalar(0.5);
    },
};

export default PointerCoordUtil;
