import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import { NEAR_EPSILON } from "../../../shared/system/sharedConstants";
import FirstPersonCamera from "./helpers/firstPerson/firstPersonCamera";
import FirstPersonProximityDetection from "./helpers/firstPerson/firstPersonProximityDetection";
import FirstPersonPointerInput from "./helpers/firstPerson/firstPersonPointerInput";
import FirstPersonKeyInput from "./helpers/firstPerson/firstPersonKeyInput";

const objTemp: THREE.Object3D = new THREE.Object3D();
const yAxis = new THREE.Vector3(0, 1, 0);

export default class FirstPersonController extends GameObjectComponent
{
    dx: number = 0;
    dy: number = 0;

    private firstPersonCamera: FirstPersonCamera = new FirstPersonCamera();
    private firstPersonProximityDetection: FirstPersonProximityDetection = new FirstPersonProximityDetection();
    private firstPersonPointerInput: FirstPersonPointerInput = new FirstPersonPointerInput();
    private firstPersonKeyInput: FirstPersonKeyInput = new FirstPersonKeyInput();

    async onSpawn(): Promise<void>
    {
        if (!this.gameObject.isMine())
            throw new Error("Only the user's own object is allowed to have the FirstPersonController component.");

        this.firstPersonCamera.onSpawn(this);
        this.firstPersonPointerInput.onSpawn(this);
        this.firstPersonKeyInput.onSpawn(this);
    }

    async onDespawn(): Promise<void>
    {
        this.firstPersonPointerInput.onDespawn(this);
        this.firstPersonKeyInput.onDespawn(this);
    }

    update(deltaTime: number): void
    {
        if (ongoingClientProcessExists())
            return;

        this.firstPersonCamera.update(deltaTime, this);
        this.firstPersonProximityDetection.update(deltaTime, this);
        this.firstPersonPointerInput.update(deltaTime, this);
        this.firstPersonKeyInput.update(deltaTime, this);

        // Speed Limit
        this.dx = Math.max(-1, Math.min(1, this.dx));
        this.dy = Math.max(-0.4, Math.min(0.4, this.dy));
        
        if (Math.abs(this.dx) > NEAR_EPSILON)
            this.gameObject.obj.rotateOnWorldAxis(yAxis, -3 * deltaTime * this.dx);

        if (Math.abs(this.dy) > NEAR_EPSILON)
        {
            objTemp.copy(this.gameObject.obj, false);
            objTemp.translateZ(-9 * deltaTime * this.dy);
            this.gameObject.trySetPosition(objTemp.position);
        }
        this.dx = 0;
        this.dy = 0;
    }
}