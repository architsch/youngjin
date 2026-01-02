import * as THREE from "three";
import GraphicsManager from "../../graphics/graphicsManager";
import MeshFactory from "../../graphics/factories/meshFactory";
import GameObjectComponent from "./gameObjectComponent";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import GameObject from "../types/gameObject";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import ObjectManager from "../objectManager";
import PlayerProximityDetector from "./playerProximityDetector";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import { numActiveTextInputsObservable } from "../../system/observables";

const vec2Temp: THREE.Vector2 = new THREE.Vector2();
const vec3Temp = new THREE.Vector3();
const vec3Temp2 = new THREE.Vector3();
const objTemp: THREE.Object3D = new THREE.Object3D();

const yAxis = new THREE.Vector3(0, 1, 0);
const maxProximityDetectionDist = 6;

export default class FirstPersonController extends GameObjectComponent
{
    private pointerIsDown: boolean = false;
    private pointerDownPos: THREE.Vector2 = new THREE.Vector2();
    private pointerDragPos: THREE.Vector2 = new THREE.Vector2();
    private pointerPos: THREE.Vector2 = new THREE.Vector2();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();

    private upKeyPressed: boolean = false;
    private downKeyPressed: boolean = false;
    private leftKeyPressed: boolean = false;
    private rightKeyPressed: boolean = false;
    private keyVelocityX: number = 0;
    private keyVelocityY: number = 0;

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
        this.onBlur = this.onBlur.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.processKey = this.processKey.bind(this);
        this.onNumActiveTextInputsUpdated = this.onNumActiveTextInputsUpdated.bind(this);
        
        canvas.addEventListener("pointerdown", this.onPointerPress);
        canvas.addEventListener("pointerup", this.onPointerRelease);
        canvas.addEventListener("pointercancel", this.onPointerRelease);
        canvas.addEventListener("pointerleave", this.onPointerRelease);
        canvas.addEventListener("pointerout", this.onPointerRelease);
        canvas.addEventListener("focusout", this.onFocusOut);
        canvas.addEventListener("blur", this.onBlur);
        canvas.addEventListener("pointermove", this.onPointerMove);
        canvas.addEventListener("click", this.onClick);
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);

        numActiveTextInputsObservable.addListener(`${this.gameObject.params.objectId}.FirstPersonController`, this.onNumActiveTextInputsUpdated);
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
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);

        numActiveTextInputsObservable.removeListener(`${this.gameObject.params.objectId}.FirstPersonController`);
    }

    update(deltaTime: number): void
    {
        if (ongoingClientProcessExists())
            return;
        
        const canvas = GraphicsManager.getGameCanvas();
        const maxSize = Math.max(canvas.width, canvas.height);
        
        let velocityX = 0;
        let velocityY = 0;

        if (this.pointerIsDown)
        {
            const mouse_x_sensitivity = 0.6 + 0.4 * (canvas.width / maxSize); // proportional to the measure of how wider the width is, compared to the height.
            const mouse_y_sensitivity = 0.7 + 0.3 * (canvas.height / maxSize); // proportional to the measure of how wider the height is, compared to the width.
            //console.log(`x_sensitivity = ${x_sensitivity.toFixed(2)}, y_sensitivity = ${y_sensitivity.toFixed(2)}`);
            const mouseInputX = this.pointerIsDown ? (this.pointerDragPos.x - this.pointerDownPos.x) : 0;
            const mouseInputY = this.pointerIsDown ? (this.pointerDragPos.y - this.pointerDownPos.y) : 0;
            velocityX = mouseInputX * mouse_x_sensitivity;
            velocityY = mouseInputY * mouse_y_sensitivity;
        }
        else
        {
            const keyInputX = (this.leftKeyPressed ? -0.25 : 0) + (this.rightKeyPressed ? 0.25 : 0);
            const keyInputY = (this.upKeyPressed ? 0.5 : 0) + (this.downKeyPressed ? -0.5 : 0);
            const diffX = keyInputX - this.keyVelocityX;
            const diffY = keyInputY - this.keyVelocityY;
            const accelX = 2 * deltaTime;
            const accelY = 2.5 * deltaTime;
            this.keyVelocityX = (Math.abs(diffX) > accelX)
                ? (this.keyVelocityX + accelX * (diffX > 0 ? 1 : -1))
                : keyInputX;
            this.keyVelocityY = (Math.abs(diffY) > accelY)
                ? (this.keyVelocityY + accelY * (diffY > 0 ? 1 : -1))
                : keyInputY;
            velocityX = this.keyVelocityX;
            velocityY = this.keyVelocityY;
        }

        const dxWithSpeedLimit = Math.max(-1, Math.min(1, velocityX));
        const dyWithSpeedLimit = Math.max(-0.4, Math.min(0.4, velocityY));
        
        if (dxWithSpeedLimit != 0)
            this.gameObject.obj.rotateOnWorldAxis(yAxis, -3 * deltaTime * dxWithSpeedLimit);

        if (dyWithSpeedLimit)
        {
            objTemp.copy(this.gameObject.obj, false);
            objTemp.translateZ(-9 * deltaTime * dyWithSpeedLimit);
            this.gameObject.trySetPosition(objTemp.position);
        }

        const currentRoom = App.getCurrentRoom();

        if (currentRoom)
        {
            const physicsObjects = PhysicsManager.getObjectsInDist(currentRoom.roomID,
                this.gameObject.position.x, this.gameObject.position.z, maxProximityDetectionDist);
            
            for (const physicsObject of physicsObjects)
            {
                const objectId = physicsObject.objectId;
                const obj = ObjectManager.getObjectById(objectId);
                if (obj != undefined)
                {
                    if (obj.spawnFinished)
                    {
                        const detector = obj.components.playerProximityDetector;
                        if (detector != undefined)
                            (detector as PlayerProximityDetector).updateProximity(this.gameObject);
                    }
                }
                else
                    console.error(`PhysicsObject with ID '${objectId}' not found in ObjectManager.`);
            }
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

            if (instanceId != undefined)
            {
                const gameObject = InstancedMeshGraphics.findGameObject(intersection.object, instanceId);
                if (gameObject != undefined)
                {
                    const instancedMeshGraphics = gameObject.components.instancedMeshGraphics;
                    if (instancedMeshGraphics)
                        gameObject.onClick(instanceId, intersection.point);
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

    private onKeyDown(ev: KeyboardEvent)
    {
        this.processKey(ev, true);
    }

    private onKeyUp(ev: KeyboardEvent)
    {
        this.processKey(ev, false);
    }

    private processKey(ev: KeyboardEvent, keyDown: boolean)
    {
        if (numActiveTextInputsObservable.peek() > 0)
        {
            return; // User is typing something in a text input, so don't process an alphabet key as a control key.
        }
        switch (ev.code)
        {
            case "ArrowUp": case "KeyW":
                ev.preventDefault();
                this.upKeyPressed = keyDown;
                break;
            case "ArrowDown": case "KeyS":
                ev.preventDefault();
                this.downKeyPressed = keyDown;
                break;
            case "ArrowLeft": case "KeyA":
                ev.preventDefault();
                this.leftKeyPressed = keyDown;
                break;
            case "ArrowRight": case "KeyD":
                ev.preventDefault();
                this.rightKeyPressed = keyDown;
                break;
        }
    }

    private onNumActiveTextInputsUpdated()
    {
        this.upKeyPressed = false;
        this.downKeyPressed = false;
        this.leftKeyPressed = false;
        this.rightKeyPressed = false;
        this.keyVelocityX = 0;
        this.keyVelocityY = 0;
    }
}

// NDC = Normalized Device Coordinates (with respect to gameCanvas)
function getNDC(ev: PointerEvent, outVec: THREE.Vector2): void
{
    const rect = (ev.target as HTMLElement).getBoundingClientRect();
    outVec.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    outVec.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
}