import * as THREE from "three";
import GraphicsManager from "../../graphics/graphicsManager";
import MeshFactory from "../../graphics/factories/meshFactory";
import GameObjectComponent from "./gameObjectComponent";
import VoxelObject from "./voxelObject";
import { SpawnType } from "../../../shared/object/types/objectTypeConfig";

const vec2Temp: THREE.Vector2 = new THREE.Vector2();
const objTemp: THREE.Object3D = new THREE.Object3D();

const yAxis = new THREE.Vector3(0, 1, 0);

export default class FirstPersonController extends GameObjectComponent
{
    private pointerIsDown: boolean = false;
    private pointerDownPos: THREE.Vector2 = new THREE.Vector2();
    private pointerDragPos: THREE.Vector2 = new THREE.Vector2();
    private pointerPos: THREE.Vector2 = new THREE.Vector2();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();

    isSpawnTypeAllowed(spawnType: SpawnType): boolean
    {
        return spawnType == "spawnedByMe";
    }

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
        this.raycastAt(ev);
    }

    private raycastAt(ev: PointerEvent): void
    {
        if (this.pointerDragPos.distanceToSquared(this.pointerDownPos) > 0.0009)
            return;

        getNDC(ev, vec2Temp);
        
        this.raycaster.setFromCamera(vec2Temp, GraphicsManager.getCamera());
        const intersections = this.raycaster.intersectObjects(MeshFactory.getMeshes());

        if (intersections.length > 0)
        {
            const instanceId = intersections[0].instanceId;
            
            if (instanceId != undefined)
            {
                const voxelObject = VoxelObject.get(instanceId);
                if (voxelObject != undefined)
                {
                    console.log(`Selected Voxel = ${JSON.stringify(voxelObject.getVoxel())}`);
                }
                else
                {
                    console.error(`VoxelObject not found (instanceId = ${instanceId})`);
                }
            }
            else
            {
                console.error(`InstanceId not found (object name = ${intersections[0].object.name})`);
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