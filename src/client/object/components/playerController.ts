import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import { NEAR_EPSILON } from "../../../shared/system/sharedConstants";
import PlayerCamera from "./helpers/player/playerCamera";
import FirstPersonProximityDetection from "./helpers/player/firstPersonProximityDetection";
import PlayerPointerInput from "./helpers/player/playerPointerInput";
import FirstPersonKeyInput from "./helpers/player/firstPersonKeyInput";
import Rigidbody from "./rigidbody";
import { DIRECTION_VECTORS } from "../../system/clientConstants";
import { cameraModeObservable } from "../../system/clientObservables";

const forwardTemp = new THREE.Vector3();

export default class PlayerController extends GameObjectComponent
{
    dx: number = 0;
    dy: number = 0;

    private playerCamera: PlayerCamera = new PlayerCamera();
    private proximityDetection: FirstPersonProximityDetection = new FirstPersonProximityDetection();
    private pointerInput: PlayerPointerInput = new PlayerPointerInput();
    private keyInput: FirstPersonKeyInput = new FirstPersonKeyInput();

    private rigidbody: Rigidbody | undefined;

    async onSpawn(): Promise<void>
    {
        if (!this.gameObject.isMine())
            throw new Error("Only the user's own object is allowed to have the PlayerController component.");

        this.rigidbody = this.gameObject.components.rigidbody as Rigidbody;
        if (!this.rigidbody)
            throw new Error("PlayerController requires Rigidbody component");

        this.playerCamera.onSpawn(this, this.pointerInput);
        this.pointerInput.onSpawn(this);
        this.keyInput.onSpawn(this);
    }

    async onDespawn(): Promise<void>
    {
        this.pointerInput.onDespawn(this);
        this.keyInput.onDespawn(this);
    }

    update(deltaTime: number): void
    {
        if (ongoingClientProcessExists())
            return;

        // Inputs update before the camera, so that the camera reacts to this frame's drag.
        this.pointerInput.update(deltaTime, this);
        this.keyInput.update(deltaTime, this);
        this.playerCamera.update(deltaTime, this);
        this.proximityDetection.update(deltaTime, this);

        if (cameraModeObservable.peek() === "selfView")
        {
            // In self-view, drag input orbits the camera (see SelfViewCameraPose)
            // instead of steering the player, so the player stands still.
            this.rigidbody?.setDesiredVelocity(0, 0, 0);
        }
        else // cameraMode === "firstPerson"
        {
            // Speed Limit
            this.dx = Math.max(-1, Math.min(1, this.dx));
            this.dy = Math.max(-0.4, Math.min(0.4, this.dy));

            if (Math.abs(this.dx) > NEAR_EPSILON)
                this.gameObject.obj.rotateOnWorldAxis(DIRECTION_VECTORS["+y"], -3 * deltaTime * this.dx);

            let vx = 0, vz = 0;
            if (Math.abs(this.dy) > NEAR_EPSILON)
            {
                this.gameObject.obj.getWorldDirection(forwardTemp);
                forwardTemp.negate(); // Player-camera's "forward" direction is the opposite of the player-gameObject's forward direction.

                const speed = 9 * this.dy;
                vx = forwardTemp.x * speed;
                vz = forwardTemp.z * speed;
            }
            this.rigidbody?.setDesiredVelocity(vx, 0, vz);
        }
        this.dx = 0;
        this.dy = 0;
    }
}
