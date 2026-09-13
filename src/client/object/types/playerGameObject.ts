import * as THREE from "three";
import GameObject from "./gameObject";
import GraphicsManager from "../../graphics/graphicsManager";
import { cameraModeObservable, objectSelectionObservable } from "../../system/clientObservables";
import InstancedMeshComposer from "../components/instancedMeshComposer";
import SpeechBubble from "../components/speechBubble";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";

const playerHalfHeightWithMargin = 0.5 * PLAYER_HEIGHT + 0.5;
const playerRadiusWithMargin = PLAYER_RADIUS_XZ + 0.5;

const vector3Temp = new THREE.Vector3();

export default class PlayerGameObject extends GameObject
{
    private instancedMeshComposer: InstancedMeshComposer;
    private speechBubble: SpeechBubble;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("PlayerGameObject requires InstancedMeshComposer component");

        this.speechBubble = this.components.speechBubble as SpeechBubble;
        if (!this.speechBubble)
            throw new Error("PlayerGameObject requires SpeechBubble component");
    }

    // Recomputed per frame, since the camera eases toward its pose (see refreshOwnVisibility).
    update(_deltaTime: number)
    {
        if (this.isMine())
            this.refreshOwnVisibility();
    }

    // Hide other players who come too close, so they don't clip the camera. (The user's own body uses
    // refreshOwnVisibility.)
    onPlayerProximityStart()
    {
        if (!this.isMine())
            this.instancedMeshComposer.setHidden(true);
    }
    // Once the other player is no longer too close to the user, show it again.
    onPlayerProximityEnd()
    {
        if (!this.isMine())
            this.instancedMeshComposer.setHidden(false);
    }

    // The user's own body (and bubble) is shown when the mode isn't first-person and the camera isn't
    // inside the body. The body is never hidden as an occluder (see OrbitOccluder), and orbiting one's
    // own character always shows it.
    private refreshOwnVisibility()
    {
        const hidden = cameraModeObservable.peek().type === "firstPerson" ||
            this.cameraIsInsideOwnBody();
        this.instancedMeshComposer.setHidden(hidden);
        this.speechBubble.setHidden(hidden);
    }

    private cameraIsInsideOwnBody(): boolean
    {
        if (objectSelectionObservable.peek()?.gameObject === this)
            return false;

        // vector3Temp = Global position of the camera
        GraphicsManager.getCamera().getWorldPosition(vector3Temp);

        const xDiff = Math.abs(vector3Temp.x - this.position.x);
        const yDiff = Math.abs(vector3Temp.y - this.position.y);
        const zDiff = Math.abs(vector3Temp.z - this.position.z);
        return yDiff <= playerHalfHeightWithMargin &&
            xDiff <= playerRadiusWithMargin &&
            zDiff <= playerRadiusWithMargin;
    }
}
