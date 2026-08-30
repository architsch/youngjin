import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import { NEAR_EPSILON } from "../../../shared/system/sharedConstants";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import App from "../../app";
import PlayerCamera from "./helpers/player/playerCamera";
import PlayerProximityDetectionUpdater from "./helpers/player/playerProximityDetectionUpdater";
import PlayerPointerInput from "./helpers/player/playerPointerInput";
import FirstPersonKeyInput from "./helpers/player/firstPersonKeyInput";
import Rigidbody from "./rigidbody";
import { DIRECTION_VECTORS } from "../../system/clientConstants";
import { cameraModeObservable } from "../../system/clientObservables";

const forwardTemp = new THREE.Vector3();

// The walk out of the doorway an arriving player is given: how far it carries him, how fast, and how
// long it may go on for at the most. The distance is what normally ends it; the time limit is there
// because a player who arrived facing something solid would otherwise never cover the distance and
// would be held walking into it forever.
const ENTERING_STRIDE_LENGTH = 1.5;
const ENTERING_SPEED = 3;
const ENTERING_MAX_DURATION = 1.5; // in seconds

export default class PlayerController extends GameObjectComponent
{
    dx: number = 0;
    dy: number = 0;

    // A player arriving in a multiplayer room spawns behind a door and is walked out from under it,
    // so that what he sees first is the room rather than the back of a panel, and so that he is
    // never left standing inside the doorway he came through.
    //
    // Where that is, and which way it faces, is whatever the server put him down at — a room may
    // hold several doors, and he arrives behind whichever one he was routed to (see
    // SpawnHotspotUtil). A player is drawn facing along his object's -Z, so that is the way out.
    private fullyEntered: boolean = false;
    private spawnPos: {x: number, z: number} = {x: 0, z: 0};
    private enteringDir: {x: number, z: number} = {x: 0, z: 0};
    private enteringTimeLeft: number = 0;

    private playerCamera: PlayerCamera = new PlayerCamera();
    private proxUpdater: PlayerProximityDetectionUpdater = new PlayerProximityDetectionUpdater();
    private pointerInput: PlayerPointerInput = new PlayerPointerInput();
    private keyInput: FirstPersonKeyInput = new FirstPersonKeyInput();

    private rigidbody: Rigidbody | undefined;

    async onSpawn(): Promise<void>
    {
        if (!this.gameObject.isMine())
            throw new Error("Only the user's own object is allowed to have the PlayerController component.");

        this.beginEntering();

        this.rigidbody = this.gameObject.components.rigidbody as Rigidbody;
        if (!this.rigidbody)
            throw new Error("PlayerController requires Rigidbody component");

        this.playerCamera.onSpawn(this, this.pointerInput);
        this.pointerInput.onSpawn(this);
        this.keyInput.onSpawn(this);
    }

    // Records the stride out of the doorway: where it starts and which way it runs. A single-player
    // room is not entered through a door at all — its player is placed by the mode's own config and
    // its opening is a scripted step's to direct — so there is nothing there to walk out of.
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

    async onDespawn(): Promise<void>
    {
        this.playerCamera.onDespawn(this);
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
        this.proxUpdater.update(deltaTime, this);

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
            if (cameraModeObservable.peek().type === "orbit")
            {
                // In the orbit mode, drag input orbits the camera (see OrbitCameraPose)
                // instead of steering the player, so the player stands still.
                this.rigidbody?.setDesiredVelocity(0, 0, 0);
            }
            else // cameraMode === "firstPerson"
            {
                // Speed Limit
                this.dx = Math.max(-1, Math.min(1, this.dx));
                this.dy = Math.max(-0.6, Math.min(0.6, this.dy));

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
        }
        this.dx = 0;
        this.dy = 0;
    }
}
