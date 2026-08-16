import * as THREE from "three";
import GameObject from "./gameObject";
import GraphicsManager from "../../graphics/graphicsManager";
import PlayerSelection from "../../graphics/types/gizmo/playerSelection";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import { cameraModeObservable } from "../../system/clientObservables";
import InstancedMeshComposer from "../components/instancedMeshComposer";
import SpeechBubble from "../components/speechBubble";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import FirstPersonCameraPose from "../components/helpers/player/firstPersonCameraPose";

const vector3Temp = new THREE.Vector3();
const vector3Temp2 = new THREE.Vector3();

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

    // Whether the user's own body is in view follows where the camera has ended up, which it
    // settles for itself as it eases toward whatever pose the active mode asks for — so the answer
    // is taken afresh each frame rather than at the moments the mode changes (see
    // refreshOwnVisibility).
    update(_deltaTime: number)
    {
        if (this.isMine())
            this.refreshOwnVisibility();
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
    // (The user's own body answers to where his own camera has come to rest instead of to proximity,
    // since it is the one body the camera is never merely near — see refreshOwnVisibility.)
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
    // camera is both pulled back from the player and standing clear of him.
    //
    // Pulled back is a matter of the mode: the first-person view is the one that keeps the camera at
    // the character's own eye, and it never shows him. Everything else is edit mode, where the
    // character is one of the things the user came to work on, and he stays on show even while the
    // user works on something else — a body that vanished the moment he selected a wall would leave
    // him editing a room he is no longer in.
    //
    // Standing clear is a matter of distance, because an orbit is pointed at whatever is being
    // edited rather than at the player, and can perfectly well be drawn around to where the player
    // happens to be standing. The body then has the camera inside it and covers the view with the
    // inside of a shoulder — which clearing the line of sight cannot help with, there being no
    // line of sight left to clear. (Where the body merely stands between the camera and what is
    // being framed, it stays where it is and the room gives way around it instead: a character is
    // not something the orbit takes out of the way — see OrbitOccluder.) The orbit around the
    // character himself is the exception, since it is the one view whose whole point is to come in
    // close to him: it frames him from far enough out to see him, and a body flickering away while
    // the camera pulls into that frame would take away the very thing the user asked to look at.
    private refreshOwnVisibility()
    {
        const hidden = cameraModeObservable.peek().type === "firstPerson" ||
            this.cameraIsInsideOwnBody();
        this.instancedMeshComposer.setHidden(hidden);
        this.speechBubble.setHidden(hidden);
    }

    private cameraIsInsideOwnBody(): boolean
    {
        if (PlayerSelection.isSelected())
            return false;

        // vector3Temp = Global position of the camera
        GraphicsManager.getCamera().getWorldPosition(vector3Temp);

        // vector3Temp2 = Global position of the player's eyes
        vector3Temp2.addVectors(this.position, FirstPersonCameraPose.restPosition);

        return vector3Temp2.distanceTo(vector3Temp) < 0.75;
    }
}
