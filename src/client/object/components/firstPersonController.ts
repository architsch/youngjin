import * as THREE from "three";
import GraphicsManager from "../../graphics/graphicsManager";
import MeshFactory from "../../graphics/factories/meshFactory";
import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import { ObjectClickCallbackMap } from "../maps/objectClickCallbackMap";
import GameObject from "../types/gameObject";

const vec2Temp: THREE.Vector2 = new THREE.Vector2();
const vec3Temp = new THREE.Vector3();
const vec3Temp2 = new THREE.Vector3();
const objTemp: THREE.Object3D = new THREE.Object3D();

const yAxis = new THREE.Vector3(0, 1, 0);

export default class FirstPersonController extends GameObjectComponent
{
    private pointerIsDown: boolean = false;
    private pointerDownPos: THREE.Vector2 = new THREE.Vector2();
    private pointerDragPos: THREE.Vector2 = new THREE.Vector2();
    private pointerPos: THREE.Vector2 = new THREE.Vector2();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();

    async onSpawn(): Promise<void>
    {
        if (!this.gameObject.isMine())
            throw new Error("Only the user's own object is allowed to have the FirstPersonController component.");

        const camera = GraphicsManager.getCamera();
        this.gameObject.obj.add(camera);
        camera.position.set(0, 2, 0);

        const pointLight = new THREE.PointLight(0xffffff, 4.0, 16, 0.5);
        camera.add(pointLight);
        pointLight.position.set(0, 0, 0);

        const canvas = GraphicsManager.getGameCanvas();
        this.onPointerPress = this.onPointerPress.bind(this);
        this.onPointerRelease = this.onPointerRelease.bind(this);
        this.onFocusOut = this.onFocusOut.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onClick = this.onClick.bind(this);
        
        canvas.addEventListener("pointerdown", this.onPointerPress);
        canvas.addEventListener("pointerup", this.onPointerRelease);
        canvas.addEventListener("pointercancel", this.onPointerRelease);
        canvas.addEventListener("pointerleave", this.onPointerRelease);
        canvas.addEventListener("pointerout", this.onPointerRelease);
        canvas.addEventListener("focusout", this.onFocusOut);
        canvas.addEventListener("pointermove", this.onPointerMove);
        canvas.addEventListener("click", this.onClick);
    }

    async onDespawn(): Promise<void>
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

    update(deltaTime: number): void
    {
        if (this.pointerIsDown)
        {
            const canvas = GraphicsManager.getGameCanvas();
            const maxSize = Math.max(canvas.width, canvas.height);
            
            const x_sensitivity = 0.6 + 0.4 * (canvas.width / maxSize); // proportional to the measure of how wider the width is, compared to the height.
            const y_sensitivity = 0.7 + 0.3 * (canvas.height / maxSize); // proportional to the measure of how wider the height is, compared to the width.
            //console.log(`x_sensitivity = ${x_sensitivity.toFixed(2)}, y_sensitivity = ${y_sensitivity.toFixed(2)}`);
            
            const dx = (this.pointerDragPos.x - this.pointerDownPos.x) * x_sensitivity;
            const dy = (this.pointerDragPos.y - this.pointerDownPos.y) * y_sensitivity;

            const dxWithSpeedLimit = Math.max(-1, Math.min(1, dx));
            const dyWithSpeedLimit = Math.max(-0.5, Math.min(0.5, dy));
            
            this.gameObject.obj.rotateOnWorldAxis(yAxis, -3 * deltaTime * dxWithSpeedLimit);

            objTemp.copy(this.gameObject.obj, false);
            objTemp.translateZ(-12 * deltaTime * dyWithSpeedLimit);
            this.gameObject.trySetPosition(objTemp.position);
        }
    }

    objectIsInLineOfSight(lookTargetWorldPosition: THREE.Vector3, lookTargetObject: GameObject): boolean
    {
        const camera = GraphicsManager.getCamera();
        camera.getWorldPosition(vec3Temp);
        
        vec3Temp2.copy(lookTargetWorldPosition);
        vec3Temp2.sub(vec3Temp);
        vec3Temp2.normalize();

        this.raycaster.set(vec3Temp, vec3Temp2);
        const intersections = this.raycaster.intersectObjects(MeshFactory.getMeshes());

        if (intersections.length > 0)
        {
            const intersection = intersections[0];
            const instanceId = intersection.instanceId;

            if (instanceId != undefined)
            {
                const gameObject = InstancedMeshGraphics.findGameObject(intersection.object, instanceId);
                if (gameObject != undefined)
                    return gameObject == lookTargetObject;
                else
                    console.error(`GameObject not found in InstancedMeshGraphics (instanceId = ${instanceId})`);
            }
            else
                console.error(`InstanceId not found (object name = ${intersection.object.name})`);
        }
        return false;
    }

    private onPointerPress(ev: PointerEvent): void
    {
        //console.log("onPointerPress");
        ev.preventDefault();
        this.pointerIsDown = true;

        getNDC(ev, this.pointerDownPos);
        getNDC(ev, this.pointerDragPos);
    }

    private onPointerRelease(ev: PointerEvent): void
    {
        //console.log("onPointerRelease");
        this.pointerIsDown = false;
    }

    private onPointerMove(ev: PointerEvent): void
    {
        //console.log("onPointerMove");
        ev.preventDefault();

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

            if (instanceId != undefined)
            {
                const gameObject = InstancedMeshGraphics.findGameObject(intersection.object, instanceId);
                if (gameObject != undefined)
                {
                    const instancedMeshGraphics = gameObject.components.instancedMeshGraphics;
                    if (instancedMeshGraphics)
                    {
                        const clickCallback = ObjectClickCallbackMap[gameObject.config.objectType];
                        if (clickCallback)
                            clickCallback(gameObject, instanceId, intersection.point);
                    }
                    else
                        console.error(`InstancedMeshGraphics component not found (spawnParams = ${JSON.stringify(gameObject.params)}, instanceId = ${instanceId})`);
                }
                else
                    console.error(`GameObject not found in InstancedMeshGraphics (instanceId = ${instanceId})`);
            }
            else
                console.error(`InstanceId not found (object name = ${intersection.object.name})`);
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