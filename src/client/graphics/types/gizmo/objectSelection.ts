import * as THREE from "three";
import GameObject from "../../../object/types/gameObject";
import { clientFeatureFlagsObservable, gameModeObservable, objectSelectionObservable,
    roomChangedObservable, updateObservable } from "../../../system/clientObservables";
import GraphicsManager from "../../graphicsManager";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";

const outlinePos = new THREE.Vector3();
const outlineQuat = new THREE.Quaternion();
const outlineScale = new THREE.Vector3();

// Rotates the upright outline square to lie flat on the ground.
const flatOnGroundQuat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0), -0.5 * Math.PI);

// The selected object. All object types (including the user's character) select the same way; per-type
// behavior is declared in ObjectTypeClientConfig.
export default class ObjectSelection
{
    gameObject: GameObject;

    constructor(gameObject: GameObject)
    {
        this.gameObject = gameObject;
    }

    static isSelected(): boolean
    {
        return objectSelectionObservable.peek() != null;
    }

    static trySelect(gameObject: GameObject): boolean
    {
        if (clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange))
        {
            return false;
        }

        // Edit mode only. Guards programmatic reselection that arrives after edit mode was left.
        if (gameModeObservable.peek() != "edit")
            return false;

        // Re-clicking the selection keeps it (only leaving edit mode deselects). Returns true either
        // way, since GameModeUtil opens edit mode through this call.
        const existingSelection = objectSelectionObservable.peek();
        if (existingSelection != null && existingSelection.gameObject === gameObject)
            return true;

        objectSelectionObservable.set(new ObjectSelection(gameObject));
        return true;
    }

    static unselect(force: boolean = false)
    {
        if (!force &&
            (clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange)))
        {
            return;
        }
        objectSelectionObservable.set(null);
    }
}

let selectionOutline: WorldSpaceOutlineRect | null = null;

// Placement comes from the collider: wall attachments are outlined on their face; other objects on
// the ground beneath them; collider-less objects use their own transform.
function refreshSelectionOutline(selection: ObjectSelection)
{
    if (!selectionOutline)
        return;

    const go = selection.gameObject;
    const collider = ObjectTypeConfigMap.getConfigByIndex(go.params.objectTypeIndex)
        .components.spawnedByAny?.collider;

    if (!collider)
    {
        selectionOutline.setTransformRaw(go.position, go.quaternion, go.obj.scale);
        return;
    }

    const size = collider.hitboxSize;
    if (collider.colliderType == "wallAttachment")
    {
        outlinePos.copy(go.position);
        outlineQuat.copy(go.quaternion);
        outlineScale.set(size.sizeX, size.sizeY, 1);
    }
    else
    {
        outlinePos.set(go.position.x, go.position.y - 0.5 * size.sizeY, go.position.z);
        outlineQuat.copy(flatOnGroundQuat);
        outlineScale.set(size.sizeX, size.sizeZ, 1);
    }
    selectionOutline.setTransformRaw(outlinePos, outlineQuat, outlineScale);
}

objectSelectionObservable.addListener("objectSelection", async (selection: ObjectSelection | null) => {
    if (!selection)
    {
        selectionOutline?.setVisible(false);
        return;
    }

    // Initialize the outline if it hasn't been initialized yet.
    if (selectionOutline == null)
    {
        selectionOutline = await WorldSpaceOutlineRect.create("#00ff00");
        selectionOutline.addToParent(GraphicsManager.getScene());
    }

    refreshSelectionOutline(selection);
    selectionOutline.setVisible(true);

    WorldSpaceSelectionUtil.unselectOthers("object");
});

// Refreshed every frame, since a selected object can still move (gizmo nudges, falling).
updateObservable.addListener("objectSelection", (_deltaTime: number) => {
    const selection = objectSelectionObservable.peek();
    if (selection && selectionOutline?.isVisible())
        refreshSelectionOutline(selection);
});

// Forced: a room change overrides any selection lock from a scripted step.
roomChangedObservable.addListener("objectSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    ObjectSelection.unselect(true);

    if (selectionOutline)
    {
        selectionOutline.dispose();
        selectionOutline = null;
    }
});
