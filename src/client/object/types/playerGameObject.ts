import GameObject from "./gameObject";
import CameraMode from "../../graphics/types/cameraMode";
import { cameraModeObservable } from "../../system/clientObservables";
import InstancedMeshComposer from "../components/instancedMeshComposer";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";

export default class PlayerGameObject extends GameObject
{
    private instancedMeshComposer: InstancedMeshComposer;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("PlayerGameObject requires InstancedMeshComposer component");
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        // Self-view camera mode (in case the player is mine)
        if (this.isMine())
        {
            this.applyCameraModeVisibility(cameraModeObservable.peek());
            cameraModeObservable.addListener(this.cameraModeListenerKey(),
                (mode) => this.applyCameraModeVisibility(mode));
        }
    }

    async onDespawn(): Promise<void>
    {
        await super.onDespawn();

        // Self-view camera mode (in case the player is mine)
        if (this.isMine())
            cameraModeObservable.removeListener(this.cameraModeListenerKey());
    }

    // If another player gets too close to the user, hide its body so it doesn't clip through the camera.
    // (The user's own body is driven by the camera mode instead, not proximity.)
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

    // The user's own body is visible only in the self-view; first-person hides it.
    private applyCameraModeVisibility(mode: CameraMode)
    {
        this.instancedMeshComposer.setHidden(mode === "firstPerson");
    }

    private cameraModeListenerKey(): string
    {
        return `playerGameObject.cameraMode.${this.params.objectId}`;
    }
}
