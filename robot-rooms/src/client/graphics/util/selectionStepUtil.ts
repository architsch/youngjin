import * as THREE from "three";
import App from "../../app";
import GraphicsManager from "../graphicsManager";
import ScreenDirection from "../types/screenDirection";
import ObjectSelection from "../types/gizmo/objectSelection";
import VoxelQuadSelection from "../types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "./worldSpaceSelectionUtil";
import ClientObjectManager from "../../object/clientObjectManager";
import ObjectTypeClientConfigMap from "../../object/maps/objectTypeClientConfigMap";
import { cameraModeObservable, objectSelectionObservable, orbitCameraAngleHoldRequestObservable,
    orbitCameraTargetOverrideObservable, voxelQuadSelectionObservable } from "../../system/clientObservables";
import { SELECTION_STEP_OBJECT_REACH } from "../../system/clientConstants";
import AABB3 from "../../../shared/math/types/aabb3";
import Vec3 from "../../../shared/math/types/vec3";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import PhysicsColliderStateUtil from "../../../shared/physics/util/physicsColliderStateUtil";
import Voxel from "../../../shared/voxel/types/voxel";
import VoxelQueryUtil from "../../../shared/voxel/util/voxelQueryUtil";

const viewRightTemp = new THREE.Vector3();
const viewUpTemp = new THREE.Vector3();
const viewBackTemp = new THREE.Vector3();
const cameraPosTemp = new THREE.Vector3();

// A face's two axes. A wall's level one comes first, so that the view's right takes it (see getStepAcrossFace)
// even where the wall is seen edge-on and lies along neither.
const FACE_AXES: {[facingAxis: string]: ["x" | "y" | "z", "x" | "y" | "z"]} = {
    x: ["z", "y"],
    y: ["x", "z"],
    z: ["x", "y"],
};

// Moves the selection the way a movement key points, as the camera shows it (see useSelectionStepKeyListener): a
// face to the face the room's surface runs on into, round a corner if need be, an object to the nearest object
// that way. Never onto anything turned away from the camera, which no step swings round to look: a face turned
// away is passed over for the next.
// A step along one surface asks the orbit to keep its angles (see orbitCameraAngleHoldRequestObservable), and so
// does every step of a face: turning to look from where it stood, as after a click, the view would soon lead the
// same key another way.

const SelectionStepUtil =
{
    // Whether the selection moved: by the user's own act, as a click moves it (see
    // WorldSpaceSelectionUtil.trySelectManually).
    tryStep: (direction: ScreenDirection): boolean =>
    {
        return WorldSpaceSelectionUtil.trySelectManually(() => {
            const voxelQuadSelection = voxelQuadSelectionObservable.peek();
            if (voxelQuadSelection)
                return tryStepToNextFace(voxelQuadSelection, direction);

            const objectSelection = objectSelectionObservable.peek();
            return objectSelection != null && tryStepToNearbyObject(objectSelection, direction);
        });
    },
}

// The face the room's surface runs on into that way (see VoxelQueryUtil.getVoxelQuadNextAlong), if it would be
// turned toward the camera and the user may select it. Turned away, it is passed over for the one the surface
// runs on into past it (a riser, going down steps seen from above), and no more than that one.
function tryStepToNextFace(selection: VoxelQuadSelection, direction: ScreenDirection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;
    const voxels = room.voxelGrid.voxels;

    const step = getStepAcrossFace(
        VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(selection.quadIndex), direction);
    let next = VoxelQueryUtil.getVoxelQuadNextAlong(voxels, selection.quadIndex, step);
    if (next >= 0 && !wouldFaceCamera(voxels, next))
    {
        next = VoxelQueryUtil.getVoxelQuadNextAlong(voxels, next,
            VoxelQueryUtil.getVoxelQuadWalkDirectionOnto(selection.quadIndex, step, next));
    }

    const voxel = (next >= 0) ? getVoxelOfQuad(voxels, next) : undefined;
    if (!voxel || !wouldFaceCamera(voxels, next) || !VoxelQuadSelection.trySelect(voxel, next))
        return false;

    orbitCameraAngleHoldRequestObservable.set(true);
    return true;
}

function getVoxelOfQuad(voxels: Voxel[], quadIndex: number): Voxel | undefined
{
    return VoxelQueryUtil.getVoxel(voxels, VoxelQueryUtil.getVoxelRowFromQuadIndex(quadIndex),
        VoxelQueryUtil.getVoxelColFromQuadIndex(quadIndex));
}

// The step across a face that a direction comes to in the view: one cell layer along one of the face's two axes.
// The view's right takes the axis it lies along more and the view's up the other, so the four directions always
// lead four different ways.
function getStepAcrossFace(facingAxis: "x" | "y" | "z", direction: ScreenDirection): Vec3
{
    readView();
    const [first, second] = FACE_AXES[facingAxis];
    const rightAxis = (Math.abs(viewRightTemp[first]) >= Math.abs(viewRightTemp[second])) ? first : second;
    const sideways = (direction == "left" || direction == "right");
    const axis = sideways ? rightAxis : ((rightAxis == first) ? second : first);
    const viewAxis = sideways ? viewRightTemp : viewUpTemp;
    const withViewAxis = (direction == "right" || direction == "up");

    const step: Vec3 = {x: 0, y: 0, z: 0};
    step[axis] = ((viewAxis[axis] >= 0) == withViewAxis) ? 1 : -1;
    return step;
}

// Whether a face would be turned toward the camera once stepped onto, however aslant. An orbit following the
// selection slides alongside with its angles and its distance kept, so it is judged from where that leaves it;
// a camera that stays where it is, from where it stands.
function wouldFaceCamera(voxels: Voxel[], quadIndex: number): boolean
{
    const voxel = getVoxelOfQuad(voxels, quadIndex);
    if (!voxel)
        return false;
    const framed = WorldSpaceSelectionUtil.getVoxelQuadOrbitTarget(voxel, quadIndex);
    const facingAxis = VoxelQueryUtil.getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
    const facingSign = (VoxelQueryUtil.getVoxelQuadOrientationFromQuadIndex(quadIndex) == "+") ? 1 : -1;

    // How far out the way the face is turned the camera comes to stand from the middle of what is framed,
    // against how far out that way the face itself lies.
    const mode = cameraModeObservable.peek();
    const cameraOffset = (mode.type == "orbit" && orbitCameraTargetOverrideObservable.peek() == null)
        ? viewBackTemp[facingAxis] * Math.hypot(cameraPosTemp.x - mode.target.center.x,
            cameraPosTemp.y - mode.target.center.y, cameraPosTemp.z - mode.target.center.z)
        : cameraPosTemp[facingAxis] - framed.center[facingAxis];
    return facingSign * cameraOffset > framed.halfSize[facingAxis];
}

// The nearest object lying that way from the selected one that the user may select, no further off than
// SELECTION_STEP_OBJECT_REACH. Never one selected only by its own control (see ObjectTypeClientConfig).
function tryStepToNearbyObject(selection: ObjectSelection, direction: ScreenDirection): boolean
{
    const room = App.getCurrentRoom();
    if (!room)
        return false;

    readView();
    const selected = selection.gameObject.params;
    const selectedBox = getObjectBox(selected);

    const candidates: {objectId: string, distance: number, centerDistance: number}[] = [];
    for (const object of Object.values(room.objectById))
    {
        if (object.objectId == selected.objectId || !isTurnedToCamera(object) || isSelectedByOwnControl(object))
            continue;

        const box = getObjectBox(object);
        const gap = getGap(selectedBox, box);
        const distance = Vector3DUtil.length(gap);
        if (distance > SELECTION_STEP_OBJECT_REACH)
            continue;

        // Which way it lies is read off the gap, so a wide object counts as above a small one under any part of it;
        // off the two middles where the objects overlap, which leaves no gap.
        const betweenCenters = Vector3DUtil.subtract(box.center, selectedBox.center);
        if (liesToward(direction, (distance > 0) ? gap : betweenCenters))
        {
            candidates.push({objectId: object.objectId, distance,
                centerDistance: Vector3DUtil.length(betweenCenters)});
        }
    }
    candidates.sort((a, b) => (a.distance - b.distance) || (a.centerDistance - b.centerDistance));

    for (const {objectId} of candidates)
    {
        const gameObject = ClientObjectManager.getObjectById(objectId);
        if (!gameObject?.canBeSelected() || !ObjectSelection.trySelect(gameObject))
            continue;

        // Onto a face turned another way (a floor's from a wall's), the view looks from where it stands instead,
        // as after a click: the object was seen to be turned toward the camera there.
        const facing = getFacing(selected);
        const newFacing = getFacing(gameObject.params);
        if (facing != undefined && newFacing != undefined && Vector3DUtil.equal(facing, newFacing))
            orbitCameraAngleHoldRequestObservable.set(true);
        return true;
    }
    return false;
}

// Whether an offset points, in the view, more the given way than to either side of it.
function liesToward(direction: ScreenDirection, offset: Vec3): boolean
{
    const right = Vector3DUtil.dot(offset, viewRightTemp);
    const up = Vector3DUtil.dot(offset, viewUpTemp);
    const sideways = (direction == "left" || direction == "right");
    const along = ((direction == "right" || direction == "up") ? 1 : -1) * (sideways ? right : up);
    return along > 0 && Math.abs(sideways ? up : right) <= along;
}

// Whether the camera is on the side an attached object shows: one seen from behind is out of sight, on the far
// face of a wall or under the floor. An object standing free shows from all round.
function isTurnedToCamera(object: AddObjectSignal): boolean
{
    const facing = getFacing(object);
    return facing == undefined
        || Vector3DUtil.dot(facing, Vector3DUtil.subtract(cameraPosTemp, object.transform.pos)) > 0;
}

function isSelectedByOwnControl(object: AddObjectSignal): boolean
{
    return ObjectTypeClientConfigMap.getConfigByIndex(object.objectTypeIndex).selection?.selectedByOwnControl == true;
}

// The way an attached object faces, as an axis. Undefined for one standing free.
function getFacing(object: AddObjectSignal): Vec3 | undefined
{
    if (!ObjectTypeConfigMap.getConfigByIndex(object.objectTypeIndex).attachment)
        return undefined;
    return Geometry3DUtil.getAxisFacingBasis(object.transform.dir).normal;
}

// The object's collider box, or just the point it is at for a type with none.
function getObjectBox(object: AddObjectSignal): AABB3
{
    return PhysicsColliderStateUtil.getObjectColliderState(object.objectTypeIndex, object.transform)?.hitbox
        ?? {center: object.transform.pos, halfSize: {x: 0, y: 0, z: 0}};
}

// How far apart two boxes are along each axis, from the first to the second: nothing along one they overlap on.
function getGap(from: AABB3, to: AABB3): Vec3
{
    const along = (axis: "x" | "y" | "z") => {
        const offset = to.center[axis] - from.center[axis];
        return Math.sign(offset) * Math.max(0, Math.abs(offset) - from.halfSize[axis] - to.halfSize[axis]);
    };
    return {x: along("x"), y: along("y"), z: along("z")};
}

// Where the camera stands, and where its view's right and up point in the world, and its back: the way from
// what it looks at to the camera.
function readView(): void
{
    const camera = GraphicsManager.getCamera();
    camera.getWorldPosition(cameraPosTemp);
    viewRightTemp.setFromMatrixColumn(camera.matrixWorld, 0);
    viewUpTemp.setFromMatrixColumn(camera.matrixWorld, 1);
    viewBackTemp.setFromMatrixColumn(camera.matrixWorld, 2);
}

export default SelectionStepUtil;
