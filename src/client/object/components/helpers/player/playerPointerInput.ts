import * as THREE from "three";
import PlayerController from "../../playerController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import MeshFactory from "../../../../graphics/factories/meshFactory";
import ClientObjectManager from "../../../clientObjectManager";
import InstancedMeshBinding from "../../../../graphics/types/mesh/instancedMeshBinding";

const vec2Temp: THREE.Vector2 = new THREE.Vector2();
const canvasSizeTemp: THREE.Vector2 = new THREE.Vector2();
const dragOffsetTemp: THREE.Vector2 = new THREE.Vector2();

// How far the pointer travels, as a physical distance, for a drag to read as one full unit of
// steering input. CSS pixels stand in for physical distance here: the page is served at
// "width=device-width, initial-scale=1", which makes one CSS pixel a density-independent unit
// rather than a hardware pixel, so this length is roughly constant across handheld screens.
//
// Measuring the drag against a fixed length, rather than against the canvas, is what keeps the
// control feeling the same whichever way the device is held. A canvas-relative measure makes the
// longer edge of the canvas the least responsive axis, and in portrait that axis is the one the
// player walks along.
const dragReferenceLengthPx = 120;

// Steering produced per reference length of pointer travel, per axis. Independent knobs: turning
// and walking are clamped to different ranges by PlayerController, so matching gains here do not
// imply the two axes reach full deflection at the same drag distance.
const dragSensitivityX = 0.85;
const dragSensitivityY = 1.25;

// A mouse is dragged from the wrist across a desk rather than with a thumb across a screen being
// held, so the same physical travel can warrant a different gain than a touch drag gets. Left
// neutral because the fixed-length measure already leaves a mouse drag more responsive than a
// canvas-relative one did on a large window; this is the knob to turn if that proves wrong.
// Applies to the steering reading only: the orbit reading is grab-style, and a control that follows
// the pointer is expected to follow it identically whatever is doing the pointing.
const mouseDragMultiplier = 0.6;

// How far the pointer may travel, in CSS pixels, while a press still counts as a click on whatever
// it started on rather than as a drag. A physical distance, so the same small slip of the finger is
// tolerated on every screen shape.
const clickSlopPx = 10;

//------------------------------------------------------------------------
// Captures raw pointer input on the game canvas, independently of the camera
// mode. It exposes the ongoing drag in two readings: a joystick-style offset
// from the press point (fed into the controller's steering), and a grab-style
// per-frame delta (dragDelta) for consumers that follow the pointer 1:1, such
// as the orbit camera. It also raycasts clicks into the scene to notify
// the clicked game object.
//------------------------------------------------------------------------

export default class PlayerPointerInput
{
    // The pointer's movement since the previous frame while a drag is ongoing (in CSS pixels).
    dragDelta: THREE.Vector2 = new THREE.Vector2();

    private pointerIsDown: boolean = false;

    // Which kind of pointer started the ongoing drag, taken from the press rather than assumed from
    // the device: a touchscreen laptop and a tablet with a mouse attached both make the device a
    // poor proxy for how the drag is actually being performed.
    private pointerIsMouse: boolean = false;

    private pointerDownPos: THREE.Vector2 = new THREE.Vector2();
    private pointerDragPos: THREE.Vector2 = new THREE.Vector2();
    private pointerLastDragPos: THREE.Vector2 = new THREE.Vector2();
    private pointerPos: THREE.Vector2 = new THREE.Vector2();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();

    onSpawn(controller: PlayerController): void
    {
        const canvas = GraphicsManager.getGameCanvas();
        this.onPointerPress = this.onPointerPress.bind(this);
        this.onPointerRelease = this.onPointerRelease.bind(this);
        this.onFocusOut = this.onFocusOut.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onClick = this.onClick.bind(this);

        canvas.addEventListener("pointerdown", this.onPointerPress);
        canvas.addEventListener("pointerup", this.onPointerRelease);
        canvas.addEventListener("pointercancel", this.onPointerRelease);
        canvas.addEventListener("pointerleave", this.onPointerRelease);
        canvas.addEventListener("pointerout", this.onPointerRelease);
        canvas.addEventListener("focusout", this.onFocusOut);
        canvas.addEventListener("blur", this.onBlur);
        canvas.addEventListener("pointermove", this.onPointerMove);
        canvas.addEventListener("click", this.onClick);
    }

    onDespawn(controller: PlayerController): void
    {
        const canvas = GraphicsManager.getGameCanvas();
        canvas.removeEventListener("pointerdown", this.onPointerPress);
        canvas.removeEventListener("pointerup", this.onPointerRelease);
        canvas.removeEventListener("pointercancel", this.onPointerRelease);
        canvas.removeEventListener("pointerleave", this.onPointerRelease);
        canvas.removeEventListener("pointerout", this.onPointerRelease);
        canvas.removeEventListener("focusout", this.onFocusOut);
        canvas.removeEventListener("pointermove", this.onPointerMove);
        canvas.removeEventListener("click", this.onClick);
    }

    update(deltaTime: number, controller: PlayerController): void
    {
        if (this.pointerIsDown)
        {
            this.getPixelOffset(this.pointerLastDragPos, this.pointerDragPos, this.dragDelta);
            this.pointerLastDragPos.copy(this.pointerDragPos);

            this.getPixelOffset(this.pointerDownPos, this.pointerDragPos, dragOffsetTemp);

            const mouseInputX = dragOffsetTemp.x / dragReferenceLengthPx;
            const mouseInputY = dragOffsetTemp.y / dragReferenceLengthPx;
            const deviceMultiplier = this.pointerIsMouse ? mouseDragMultiplier : 1;

            controller.dx += mouseInputX * dragSensitivityX * deviceMultiplier;
            controller.dy += mouseInputY * dragSensitivityY * deviceMultiplier;
        }
        else
            this.dragDelta.set(0, 0);
    }

    // Pointer positions are captured in NDC, where each axis is normalized by its own edge of the
    // canvas — so on a canvas that is not square, the same NDC distance means different amounts of
    // travel on the two axes. Scaling by half the canvas size (half, because NDC spans -1..1 across
    // a full edge) recovers CSS pixels, the unit every drag measurement in this class works in.
    private getPixelOffset(fromPos: THREE.Vector2, toPos: THREE.Vector2, outVec: THREE.Vector2): THREE.Vector2
    {
        GraphicsManager.getGameRenderer().getSize(canvasSizeTemp);
        return outVec.subVectors(toPos, fromPos).multiply(canvasSizeTemp).multiplyScalar(0.5);
    }

    private onPointerPress(ev: PointerEvent): void
    {
        //console.log("onPointerPress");
        this.pointerIsDown = true;
        this.pointerIsMouse = (ev.pointerType === "mouse");

        // Capture the pointer so drag continues even when the cursor passes
        // over CSS2D overlays (e.g. WorldSpaceArrow click targets).
        const canvas = GraphicsManager.getGameCanvas();
        canvas.setPointerCapture(ev.pointerId);

        getNDC(ev, this.pointerDownPos);
        getNDC(ev, this.pointerDragPos);
        this.pointerLastDragPos.copy(this.pointerDragPos);
    }

    private onPointerRelease(ev: PointerEvent): void
    {
        //console.log("onPointerRelease");
        this.pointerIsDown = false;
    }

    private onPointerMove(ev: PointerEvent): void
    {
        //console.log("onPointerMove");
        getNDC(ev, this.pointerPos);
        if (this.pointerIsDown)
        {
            getNDC(ev, this.pointerDragPos);
        }
    }

    private onFocusOut(ev: FocusEvent): void
    {
        //console.log("onFocusOut");
        this.pointerIsDown = false;
    }

    private onBlur(ev: FocusEvent): void
    {
        //console.log("onBlur");
        this.pointerIsDown = false;
    }

    private onClick(ev: PointerEvent): void
    {
        ev.preventDefault();
        this.clickRaycast(ev);
    }

    private clickRaycast(ev: PointerEvent): void
    {
        if (this.getPixelOffset(this.pointerDownPos, this.pointerDragPos, dragOffsetTemp).lengthSq()
            > clickSlopPx * clickSlopPx)
            return;

        getNDC(ev, vec2Temp);

        this.raycaster.setFromCamera(vec2Temp, GraphicsManager.getCamera());
        const intersections = this.raycaster.intersectObjects(MeshFactory.getMeshes());

        if (intersections.length > 0)
        {
            const intersection = intersections[0];
            const instanceId = intersection.instanceId;

            if (instanceId != undefined) // Raycast target is an instanced mesh.
            {
                const gameObject = InstancedMeshBinding.findGameObject(intersection.object, instanceId);
                if (gameObject != undefined)
                {
                    const instancedMeshGraphics = gameObject.components.instancedMeshGraphics;
                    if (instancedMeshGraphics)
                        gameObject.onClick(instanceId, intersection.point);
                    else
                        console.error(`InstancedMeshGraphics component not found (params = ${JSON.stringify(gameObject.params)}, instanceId = ${instanceId})`);
                }
                else
                    console.error(`GameObject not found in InstancedMeshGraphics (instanceId = ${instanceId})`);
            }
            else // Raycast target is a regular mesh.
            {
                const objectId = intersection.object.name; // For regular (non-instanced) meshes, (intersection.object.name == meshId == objectId).
                const gameObject = ClientObjectManager.getObjectById(objectId);
                if (gameObject != undefined)
                {
                    const meshGraphics = gameObject.components.meshGraphics;
                    if (meshGraphics)
                        gameObject.onClick(-1, intersection.point);
                    else
                        console.error(`MeshGraphics component not found (${JSON.stringify(gameObject.params)})`);
                }
                else
                    console.error(`GameObject not found from mesh (objectId = ${objectId})`);
            }
        }
    }
}

// NDC = Normalized Device Coordinates (with respect to gameCanvas)
function getNDC(ev: PointerEvent, outVec: THREE.Vector2): void
{
    const rect = (ev.target as HTMLElement).getBoundingClientRect();
    outVec.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    outVec.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}
