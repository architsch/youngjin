import * as THREE from "three";
import PlayerController from "../../playerController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import MeshFactory from "../../../../graphics/factories/meshFactory";
import ClientObjectManager from "../../../clientObjectManager";
import InstancedMeshBinding from "../../../../graphics/types/mesh/instancedMeshBinding";

const vec2Temp: THREE.Vector2 = new THREE.Vector2();

//------------------------------------------------------------------------
// Captures raw pointer input on the game canvas, independently of the camera
// mode. It exposes the ongoing drag in two readings: a joystick-style offset
// from the press point (fed into the controller's steering), and a grab-style
// per-frame delta (dragDelta) for consumers that follow the pointer 1:1, such
// as the self-view orbit. It also raycasts clicks into the scene to notify
// the clicked game object.
//------------------------------------------------------------------------

export default class PlayerPointerInput
{
    // The pointer's movement since the previous frame while a drag is ongoing (in NDC units).
    dragDelta: THREE.Vector2 = new THREE.Vector2();

    private pointerIsDown: boolean = false;
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
            this.dragDelta.subVectors(this.pointerDragPos, this.pointerLastDragPos);
            this.pointerLastDragPos.copy(this.pointerDragPos);

            const canvas = GraphicsManager.getGameCanvas();
            const maxSize = Math.max(canvas.width, canvas.height);

            const mouse_x_sensitivity = 0.6 + 0.4 * (canvas.width / maxSize); // proportional to the measure of how wider the width is, compared to the height.
            const mouse_y_sensitivity = 0.7 + 0.3 * (canvas.height / maxSize); // proportional to the measure of how wider the height is, compared to the width.

            const mouseInputX = this.pointerDragPos.x - this.pointerDownPos.x;
            const mouseInputY = this.pointerDragPos.y - this.pointerDownPos.y;

            controller.dx += mouseInputX * mouse_x_sensitivity;
            controller.dy += mouseInputY * mouse_y_sensitivity;
        }
        else
            this.dragDelta.set(0, 0);
    }

    private onPointerPress(ev: PointerEvent): void
    {
        //console.log("onPointerPress");
        this.pointerIsDown = true;

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
        if (this.pointerDragPos.distanceToSquared(this.pointerDownPos) > 0.0009)
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
