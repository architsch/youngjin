import GameObject from "./gameObject";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import { cameraModeObservable, objectSelectionObservable,
    voxelQuadSelectionObservable } from "../../system/clientObservables";
import InstancedMeshComposer from "../components/instancedMeshComposer";
import SpeechBubble from "../components/speechBubble";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";

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

        // Whether the user's own body is in view follows what the camera is doing and what is
        // selected, either of which can change at any moment (see refreshOwnVisibility).
        if (this.isMine())
        {
            this.refreshOwnVisibility();
            const listenerKey = this.visibilityListenerKey();
            cameraModeObservable.addListener(listenerKey, () => this.refreshOwnVisibility());
            voxelQuadSelectionObservable.addListener(listenerKey, () => this.refreshOwnVisibility());
            objectSelectionObservable.addListener(listenerKey, () => this.refreshOwnVisibility());
        }
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        if (this.isMine())
        {
            const listenerKey = this.visibilityListenerKey();
            cameraModeObservable.removeListener(listenerKey);
            voxelQuadSelectionObservable.removeListener(listenerKey);
            objectSelectionObservable.removeListener(listenerKey);
        }
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

    // The user's own body, and the speech bubble that belongs to it, are in view only while the
    // camera orbits the character himself. First-person hides the body so it never clips the camera,
    // and so does a selection: the camera then orbits whatever was selected, from angles that keep
    // putting the character between the camera and the very thing he is editing — and one's own
    // body, unlike a wall, is never what the user meant to look at there. Customizing the character
    // is the one orbit that is about the body, and nothing can be selected while it is open, so the
    // body stays in view for it.
    private refreshOwnVisibility()
    {
        const hidden = cameraModeObservable.peek().type === "firstPerson" ||
            WorldSpaceSelectionUtil.isAnythingSelected();
        this.instancedMeshComposer.setHidden(hidden);
        this.speechBubble.setHidden(hidden);
    }

    private visibilityListenerKey(): string
    {
        return `playerGameObject.visibility.${this.params.objectId}`;
    }
}
