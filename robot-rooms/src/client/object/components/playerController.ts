import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import { ENTERING_MAX_DURATION, ENTERING_SPEED,
    ENTERING_STRIDE_LENGTH } from "../../../shared/object/types/objectTypeConfig/doorObjectTypeConfig";
import { PLAYER_MAX_TURN_INPUT, PLAYER_MAX_WALK_INPUT, PLAYER_TURN_RATE_PER_INPUT,
    PLAYER_WALK_SPEED_PER_INPUT } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { NEAR_EPSILON } from "../../../shared/system/sharedConstants";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import App from "../../app";
import PlayerCamera from "./helpers/player/playerCamera";
import PlayerProximityDetectionUpdater from "./helpers/player/playerProximityDetectionUpdater";
import PlayerPointerInput from "./helpers/player/playerPointerInput";
import FirstPersonKeyInput from "./helpers/player/firstPersonKeyInput";
import Rigidbody from "./rigidbody";
import InstancedMeshComposer from "./instancedMeshComposer";
import { DIRECTION_VECTORS } from "../../system/clientConstants";
import { cameraModeObservable } from "../../system/clientObservables";
import ClientObjectManager from "../clientObjectManager";
import ObjectTransform from "../../../shared/object/types/objectTransform";
import PeriodicTransformEmitter from "./periodicTransformEmitter";

const forwardTemp = new THREE.Vector3();

export default class PlayerController extends GameObjectComponent
{
    dx: number = 0;
    dy: number = 0;

    // Multiplayer arrivals spawn behind a door (see SpawnHotspotUtil) and walk out along -Z, so the
    // first view is the room and the player never rests in the doorway.
    private fullyEntered: boolean = false;
    private spawnPos: {x: number, z: number} = {x: 0, z: 0};
    private enteringDir: {x: number, z: number} = {x: 0, z: 0};
    private enteringTimeLeft: number = 0;

    private playerCamera: PlayerCamera = new PlayerCamera();
    private proxUpdater: PlayerProximityDetectionUpdater = new PlayerProximityDetectionUpdater();
    private pointerInput: PlayerPointerInput = new PlayerPointerInput();
    private keyInput: FirstPersonKeyInput = new FirstPersonKeyInput();

    private rigidbody: Rigidbody | undefined;
    private composer: InstancedMeshComposer | undefined;

    async onSpawn(): Promise<void>
    {
        if (!this.gameObject.isMine())
            throw new Error("Only the user's own object is allowed to have the PlayerController component.");

        this.beginEntering();

        this.rigidbody = this.gameObject.components.rigidbody as Rigidbody;
        if (!this.rigidbody)
            throw new Error("PlayerController requires Rigidbody component");
        this.composer = this.gameObject.components.instancedMeshComposer as InstancedMeshComposer | undefined;

        this.playerCamera.onSpawn(this.gameObject, this.pointerInput);
        this.pointerInput.onSpawn(this);
        this.keyInput.onSpawn(this);

        this.finishEnteringIfHidden = this.finishEnteringIfHidden.bind(this);
        document.addEventListener("visibilitychange", this.finishEnteringIfHidden);
        this.finishEnteringIfHidden();
    }

    // Single-player rooms aren't entered through a door, so there's nothing to walk out of.
    private beginEntering(): void
    {
        this.fullyEntered = App.getCurrentRoom()?.roomType == RoomTypeEnumMap.SinglePlayer;
        if (this.fullyEntered)
            return;

        this.spawnPos.x = this.gameObject.position.x;
        this.spawnPos.z = this.gameObject.position.z;

        this.gameObject.obj.getWorldDirection(forwardTemp);
        forwardTemp.negate(); // The player faces along his object's -Z (see FORWARD_DIR).
        const length = Math.hypot(forwardTemp.x, forwardTemp.z);
        if (length <= NEAR_EPSILON)
        {
            this.fullyEntered = true; // No direction to walk in, so there is no walk to make.
            return;
        }
        this.enteringDir.x = forwardTemp.x / length;
        this.enteringDir.z = forwardTemp.z / length;
        this.enteringTimeLeft = ENTERING_MAX_DURATION;
    }

    // The walk runs on frames, which a hidden page doesn't get: it is made in one step instead, and sent at once, or
    // everyone else would see the player behind the door until the page is shown.
    private finishEnteringIfHidden(): void
    {
        if (this.fullyEntered || document.visibilityState != "hidden")
            return;
        this.fullyEntered = true;

        const {position, direction} = this.gameObject;
        ClientObjectManager.setObjectTransform(this.gameObject.params.objectId, new ObjectTransform(
            {
                x: this.spawnPos.x + this.enteringDir.x * ENTERING_STRIDE_LENGTH,
                y: position.y,
                z: this.spawnPos.z + this.enteringDir.z * ENTERING_STRIDE_LENGTH,
            },
            {x: direction.x, y: direction.y, z: direction.z}, this.gameObject.params.transform.scale), false);
        (this.gameObject.components.periodicTransformEmitter as PeriodicTransformEmitter).syncNow();
    }

    async onDespawn(): Promise<void>
    {
        document.removeEventListener("visibilitychange", this.finishEnteringIfHidden);
        this.playerCamera.onDespawn();
        this.pointerInput.onDespawn(this);
        this.keyInput.onDespawn(this);
    }

    update(deltaTime: number): void
    {
        if (ongoingClientProcessExists())
            return;

        this.pointerInput.update(deltaTime, this);
        this.keyInput.update(deltaTime, this);
        this.proxUpdater.update(deltaTime, this.gameObject);

        if (!this.fullyEntered)
        {
            this.enteringTimeLeft -= deltaTime;
            const travelled = Math.hypot(
                this.gameObject.position.x - this.spawnPos.x,
                this.gameObject.position.z - this.spawnPos.z);
            if (travelled >= ENTERING_STRIDE_LENGTH || this.enteringTimeLeft <= 0)
                this.fullyEntered = true;
        }

        if (!this.fullyEntered)
        {
            const v = this.rigidbody?.getDesiredVelocity()!;
            this.rigidbody?.setDesiredVelocity(
                v.x + this.enteringDir.x * ENTERING_SPEED, v.y,
                v.z + this.enteringDir.z * ENTERING_SPEED);
        }
        else
        {
            const cameraModeType = cameraModeObservable.peek().type;

            if (cameraModeType === "orbit" || cameraModeType === "free")
            {
                this.rigidbody?.setDesiredVelocity(0, 0, 0);
            }
            else // cameraMode === "firstPerson"
            {
                // Speed Limit
                this.dx = Math.max(-PLAYER_MAX_TURN_INPUT, Math.min(PLAYER_MAX_TURN_INPUT, this.dx));
                this.dy = Math.max(-PLAYER_MAX_WALK_INPUT, Math.min(PLAYER_MAX_WALK_INPUT, this.dy));

                if (Math.abs(this.dx) > NEAR_EPSILON)
                {
                    this.gameObject.obj.rotateOnWorldAxis(DIRECTION_VECTORS["+y"],
                        -PLAYER_TURN_RATE_PER_INPUT * deltaTime * this.dx);
                    this.gameObject.notifyTransformChanged();
                }

                let vx = 0, vz = 0;
                if (Math.abs(this.dy) > NEAR_EPSILON)
                {
                    this.gameObject.obj.getWorldDirection(forwardTemp);
                    forwardTemp.negate(); // Player-camera's "forward" direction is the opposite of the player-gameObject's forward direction.

                    const speed = PLAYER_WALK_SPEED_PER_INPUT * this.dy;
                    vx = forwardTemp.x * speed;
                    vz = forwardTemp.z * speed;
                }
                this.rigidbody?.setDesiredVelocity(vx, 0, vz);
            }
        }
        this.dx = 0;
        this.dy = 0;
    }

    // The camera follows after this frame's input and physics, so it reacts to this frame's drag and
    // sees where the player actually ended up.
    lateUpdate(deltaTime: number): void
    {
        if (ongoingClientProcessExists())
            return;

        this.playerCamera.update(deltaTime, this.gameObject, this.rigidbody!.getImposedDisplacement(),
            this.rigidbody!.isUnderForce());
        // A mirror shows the body where the view has it, so that the two move as one while the camera trails a push.
        this.composer?.setReflectionOffset(this.playerCamera.getTrail());
    }
}
