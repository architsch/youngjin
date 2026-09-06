import * as THREE from "three";
import GameObject from "./gameObject";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import Vec3 from "../../../shared/math/types/vec3";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { LAMP_FOOTPRINT_HEIGHT, LAMP_FOOTPRINT_WIDTH } from "../../../shared/system/sharedConstants";
import RoomValidationUtil from "../../../shared/room/util/roomValidationUtil";
import GraphicsManager from "../../graphics/graphicsManager";
import WorldSpaceSelectionUtil from "../../graphics/util/worldSpaceSelectionUtil";
import ObjectSelection from "../../graphics/types/gizmo/objectSelection";
import GameModeUtil from "../../system/util/gameModeUtil";
import App from "../../app";
import LightSource from "../components/lightSource";
import InstancedMeshComposer from "../components/instancedMeshComposer";

const vector3Temp = new THREE.Vector3();

// The patch of wall a lamp lays claim to, which is what its selection outline frames and what its
// move arrows are placed around.
const selectionOutlineScale = new THREE.Vector3(LAMP_FOOTPRINT_WIDTH, LAMP_FOOTPRINT_HEIGHT, 1);

// A light somebody installed on a wall. What is drawn is the composer's business and what is lit is
// the light source's; what this class does is keep the two pointed at the same place and the same
// color as the lamp is moved and adjusted.
export default class LampGameObject extends GameObject
{
    private lightSource: LightSource;
    private instancedMeshComposer: InstancedMeshComposer;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.lightSource = this.components.lightSource as LightSource;
        if (!this.lightSource)
            throw new Error("LampGameObject requires LightSource component");

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("LampGameObject requires InstancedMeshComposer component");
    }

    // Moving a lamp moves the light it gives off, and there is no update loop to notice that: a wall
    // attachment is placed rather than driven, so this is called a handful of times as somebody
    // slides one along a wall. (The parts follow on their own — the composer re-bakes its instances
    // whenever the object's world matrix changes.)
    setObjectTransform(pos: Vec3, dir: Vec3)
    {
        super.setObjectTransform(pos, dir);
        this.lightSource.setTransform(pos, dir);
    }

    // Re-lighting a lamp also repaints it: the lit face takes its color from the same setting the
    // light does, and the parts are derived from that setting rather than stored beside it, so they
    // have to be built again from the new one (see LampObjectTypeConfig).
    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.LightProperties)
            this.instancedMeshComposer.reloadComposition();
    }

    getSelectionOutlineScale(): THREE.Vector3
    {
        return selectionOutlineScale;
    }

    // Only an admin can do anything with a lamp, so only an admin can pick one out. For everybody
    // else it is part of the room's furniture: a click passes through it the way a click on a wall
    // does.
    onClick(instanceId: number, hitPoint: THREE.Vector3)
    {
        if (!RoomValidationUtil.userIsAdmin(App.getUser()))
            return;

        GraphicsManager.getCamera().getWorldPosition(vector3Temp);
        if (hitPoint.distanceTo(vector3Temp) > WorldSpaceSelectionUtil.getMaxSelectDist())
            return;

        // Taking hold of a lamp is the start of working on it, and there is nothing else it is
        // picked out for — so the mode that work happens in opens along with the selection, exactly
        // as it does for a door.
        if (ObjectSelection.trySelect(this))
            GameModeUtil.enterEditModeOnCurrentSelection();
    }
}
