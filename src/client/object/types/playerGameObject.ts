import * as THREE from "three";
import GameObject from "./gameObject";
import GraphicsManager from "../../graphics/graphicsManager";
import PlayerSelection from "../../graphics/types/gizmo/playerSelection";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import { cameraModeObservable } from "../../system/clientObservables";
import InstancedMeshComposer from "../components/instancedMeshComposer";
import SpeechBubble from "../components/speechBubble";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";

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

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        // Whether the user's own body is in view follows what the camera is doing, which can change
        // at any moment (see refreshOwnVisibility).
        if (this.isMine())
        {
            this.refreshOwnVisibility();
            cameraModeObservable.addListener(this.visibilityListenerKey(),
                () => this.refreshOwnVisibility());
        }
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        if (this.isMine())
            cameraModeObservable.removeListener(this.visibilityListenerKey());
    }

    // The user's own character is a part of the room while he is editing it — one he can pick out
    // and work on like any other, which is what brings up the form for changing his look. Other
    // players' characters answer to nobody's click.
    onClick(_instanceId: number, hitPoint: THREE.Vector3)
    {
        if (!this.isMine())
            return;

        GraphicsManager.getCamera().getWorldPosition(vector3Temp);
        if (hitPoint.distanceTo(vector3Temp) > WorldSpaceSelectionUtil.getMaxSelectDist())
            return;

        PlayerSelection.trySelect(this);
    }

    // If another player gets too close to the user, hide its body so it doesn't clip through the camera.
    // (The user's own body is driven by the camera mode and the selection instead, not proximity.)
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

    // The user's own body, and the speech bubble that belongs to it, are in view for as long as the
    // camera is pulled back from the player — which is to say throughout edit mode, whatever is
    // currently selected in it. The character is one of the things the user came into that mode to
    // work on, and it stays on show even while he works on something else, since a body that
    // vanished the moment he selected a wall would leave him editing a room he is no longer in. The
    // first-person view is the one that hides it, so that it never clips the camera. (Whenever the
    // body does get between the camera and what is being framed, OrbitOcclusionHider takes it out
    // of the way, the same as it does for anything else standing in the way.)
    private refreshOwnVisibility()
    {
        const hidden = cameraModeObservable.peek().type === "firstPerson";
        this.instancedMeshComposer.setHidden(hidden);
        this.speechBubble.setHidden(hidden);
    }

    private visibilityListenerKey(): string
    {
        return `playerGameObject.visibility.${this.params.objectId}`;
    }
}
