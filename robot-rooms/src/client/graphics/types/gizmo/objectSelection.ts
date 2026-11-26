import * as THREE from "three";
import GameObject from "../../../object/types/gameObject/gameObject";
import { clientFeatureFlagsObservable, gameModeObservable, objectSelectionObservable, playModeSelectionObservable,
    roomChangedObservable, selectionEditBlockedObservable, updateObservable } from "../../../system/clientObservables";
import Vec3 from "../../../../shared/math/types/vec3";
import WorldSpaceOutlineBox from "./generic/worldSpaceOutlineBox";
import { SELECTION_BLOCKED_COLOR, SELECTION_COLOR } from "../../../system/clientConstants";
import GraphicsManager from "../../graphicsManager";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";
import RoomRuntimeMemory from "../../../../shared/room/types/roomRuntimeMemory";
import WorldSpaceSelectionUtil from "../../util/worldSpaceSelectionUtil";
import { FeatureFlag } from "../../../../shared/system/types/featureFlag";
import WorldSpaceOutlineRect from "./generic/worldSpaceOutlineRect";
import ObjectTypeClientConfigMap from "../../../object/maps/objectTypeClientConfigMap";

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

    // force: overrides scripted locks (see GameModeUtil.enterEditMode).
    static trySelect(gameObject: GameObject, force: boolean = false): boolean
    {
        if (!force &&
            (clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange) ||
            clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange)))
        {
            return false;
        }

        // Edit mode only. Guards programmatic reselection that arrives after edit mode was left.
        if (gameModeObservable.peek() != "edit")
            return false;

        // Re-clicking the selection keeps it (only leaving edit mode deselects), and it still counts
        // as selected.
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
// For a type outlined as a box about its body (see ObjectTypeClientConfig).
let selectionBoxOutline: WorldSpaceOutlineBox | null = null;

// The object outlined: the selection, or the one selected in play mode (see PlayModeSelectionUtil).
function getOutlinedObject(): GameObject | null
{
    return objectSelectionObservable.peek()?.gameObject ?? playModeSelectionObservable.peek();
}

function getOutlineBoxSize(go: GameObject): Vec3 | undefined
{
    return ObjectTypeClientConfigMap.getConfigByIndex(go.params.objectTypeIndex).selection?.outlineBoxSize;
}

// A box goes about the object's middle, turned as it is, and up with whatever motion its looks alone make (a hop).
// Attached objects are outlined on their face; other objects on the ground beneath their collider;
// collider-less objects use their own transform.
function refreshSelectionOutline(go: GameObject)
{
    const boxSize = getOutlineBoxSize(go);
    if (boxSize != undefined)
    {
        outlinePos.copy(go.position);
        outlinePos.y += go.visualObj.position.y;
        selectionBoxOutline?.setBox(outlinePos, boxSize);
        selectionBoxOutline?.setOrientation(go.quaternion);
        return;
    }
    if (!selectionOutline)
        return;

    const config = ObjectTypeConfigMap.getConfigByIndex(go.params.objectTypeIndex);

    if (!config.components.spawnedByAny?.collider)
    {
        selectionOutline.setTransformRaw(go.position, go.quaternion, go.obj.scale);
        return;
    }

    // The object's own footprint, not the type's, so the outline follows a resize.
    const size = ObjectScaleUtil.getObjectSize(go.params.objectTypeIndex, go.params.transform.scale);
    if (config.attachment)
    {
        outlinePos.copy(go.position);
        outlineQuat.copy(go.quaternion);
        outlineScale.set(size.x, size.y, 1);
    }
    else
    {
        outlinePos.set(go.position.x, go.position.y - 0.5 * size.y, go.position.z);
        outlineQuat.copy(flatOnGroundQuat);
        outlineScale.set(size.x, size.z, 1);
    }
    selectionOutline.setTransformRaw(outlinePos, outlineQuat, outlineScale);
}

// Makes the outline the selected object's type takes, the first time one is needed: nothing to wait for otherwise.
function makeSelectionOutline(): Promise<void> | undefined
{
    const selected = getOutlinedObject();
    if (selected == null)
        return undefined;
    if (getOutlineBoxSize(selected) != undefined)
        return (selectionBoxOutline == null) ? makeBoxOutline() : undefined;
    return (selectionOutline == null) ? makeRectOutline() : undefined;
}
async function makeBoxOutline(): Promise<void>
{
    const outline = await WorldSpaceOutlineBox.create(SELECTION_COLOR);
    // (Another selection may have made one meanwhile.)
    if (selectionBoxOutline != null)
    {
        outline.dispose();
        return;
    }
    selectionBoxOutline = outline;
    outline.addToParent(GraphicsManager.getScene());
}
async function makeRectOutline(): Promise<void>
{
    selectionOutline = await WorldSpaceOutlineRect.create(SELECTION_COLOR);
    selectionOutline.addToParent(GraphicsManager.getScene());
}

// Shows the outline of whatever is selected now, if anything, of the kind its type takes.
function showSelectionOutline(): void
{
    const go = getOutlinedObject();
    const boxed = go != null && getOutlineBoxSize(go) != undefined;
    if (go != null)
        refreshSelectionOutline(go);
    // (A type that outlines its own selection is left to; see ObjectTypeClientConfig.)
    selectionOutline?.setVisible(go != null && !boxed && !ObjectTypeClientConfigMap.getConfigByIndex(
        go.params.objectTypeIndex).selection?.selectedByOwnControl);
    selectionBoxOutline?.setVisible(boxed);
}

// (Both at once, unless an outline has first to be made.)
objectSelectionObservable.addListener("objectSelection", async (selection: ObjectSelection | null) => {
    const made = makeSelectionOutline();
    if (made != undefined)
        await made;
    showSelectionOutline();
    if (selection)
        WorldSpaceSelectionUtil.unselectOthers("object");
});
playModeSelectionObservable.addListener("objectSelection", async () => {
    const made = makeSelectionOutline();
    if (made != undefined)
        await made;
    showSelectionOutline();
});

selectionEditBlockedObservable.addListener("objectSelection", (blocked: boolean) => {
    const color = blocked ? SELECTION_BLOCKED_COLOR : SELECTION_COLOR;
    selectionOutline?.setColor(color);
    selectionBoxOutline?.setLook(color, 1, true);
});

// Refreshed every frame, since a selected object can still move or change size (gizmo drags, falling).
updateObservable.addListener("objectSelection", (_deltaTime: number) => {
    const go = getOutlinedObject();
    if (go != null && (selectionOutline?.isVisible() || selectionBoxOutline?.isVisible()))
        refreshSelectionOutline(go);
});

// Forced: a room change overrides any selection lock from a scripted step.
roomChangedObservable.addListener("objectSelection", async (_roomRuntimeMemory: RoomRuntimeMemory) => {
    ObjectSelection.unselect(true);

    if (selectionOutline)
    {
        selectionOutline.dispose();
        selectionOutline = null;
    }
    if (selectionBoxOutline)
    {
        selectionBoxOutline.dispose();
        selectionBoxOutline = null;
    }
});
