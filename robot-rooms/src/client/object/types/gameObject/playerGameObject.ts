import * as THREE from "three";
import GameObject from "./gameObject";
import GraphicsManager from "../../../graphics/graphicsManager";
import { cameraModeObservable, myPlayerHiddenObservable,
    objectSelectionObservable } from "../../../system/clientObservables";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import SpeechBubble from "../../components/speechBubble";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { PLAYER_HEIGHT, PLAYER_RADIUS_XZ } from "../../../../shared/object/types/objectTypeConfig/playerObjectTypeConfig";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import AdminPrefsUtil from "../../../../shared/object/util/adminPrefsUtil";
import App from "../../../app";

const playerHalfHeightWithMargin = 0.5 * PLAYER_HEIGHT + 1;
const playerRadiusWithMargin = PLAYER_RADIUS_XZ + 1;

const vector3Temp = new THREE.Vector3();

export default class PlayerGameObject extends GameObject
{
    private instancedMeshComposer: InstancedMeshComposer;
    private speechBubble: SpeechBubble;

    // Cached from the AdminPrefs metadata, since the user's own visibility is recomputed per frame.
    private ghostMode: boolean;
    private tooCloseToCamera: boolean = false;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("PlayerGameObject requires InstancedMeshComposer component");

        this.speechBubble = this.components.speechBubble as SpeechBubble;
        if (!this.speechBubble)
            throw new Error("PlayerGameObject requires SpeechBubble component");

        this.ghostMode = AdminPrefsUtil.getObjectPrefs(params).ghostMode;
        // Before spawn, so a ghost is never drawn for a frame.
        this.refreshOtherPlayerVisibility();
    }

    // Recomputed per frame, since the camera eases toward its pose (see refreshOwnVisibility).
    update(_deltaTime: number)
    {
        if (this.isSeenThrough())
            this.refreshOwnVisibility();
    }

    // Other players who come too close are hidden, so they don't clip the camera.
    onPlayerProximityStart()
    {
        this.tooCloseToCamera = true;
        this.refreshOtherPlayerVisibility();
    }
    onPlayerProximityEnd()
    {
        this.tooCloseToCamera = false;
        this.refreshOtherPlayerVisibility();
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key !== ObjectMetadataKeyEnumMap.AdminPrefs)
            return;
        this.ghostMode = AdminPrefsUtil.getObjectPrefs(this.params).ghostMode;
        this.refreshOtherPlayerVisibility();
    }

    // A ghost's body and bubble are hidden from everyone (see AdminPrefs), and a body too close from the camera alone. The
    // character the camera is at uses refreshOwnVisibility instead.
    private refreshOtherPlayerVisibility()
    {
        if (this.isSeenThrough())
            return;
        this.instancedMeshComposer.setHidden(this.ghostMode);
        this.instancedMeshComposer.setHiddenFromCamera(this.tooCloseToCamera);
        this.speechBubble.setHidden(this.ghostMode);
    }

    // The body (and bubble) the camera is at is shown when it isn't a ghost, no scripted step hides it, the mode
    // isn't first-person and the camera isn't inside the body; in those last two, the body is hidden from the camera
    // alone, so a mirror still shows it. The body is never hidden as an occluder (see OrbitOccluder), and orbiting
    // one's own character shows it unless a step hides it.
    private refreshOwnVisibility()
    {
        const hidden = this.ghostMode || myPlayerHiddenObservable.peek();
        const seenFromInside = cameraModeObservable.peek().type === "firstPerson" || this.cameraIsInsideOwnBody();
        this.instancedMeshComposer.setHidden(hidden);
        this.instancedMeshComposer.setHiddenFromCamera(seenFromInside);
        this.speechBubble.setHidden(hidden || seenFromInside);
    }

    // Whose eyes the camera is at: the user's own player's, or the agent's a camera page watches (see
    // WatchedPlayerCameraUtil).
    private isSeenThrough(): boolean
    {
        return this.isMine() || this.params.sourceUserID == App.getWatchedUserID();
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
