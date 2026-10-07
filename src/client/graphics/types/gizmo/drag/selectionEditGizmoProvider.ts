import * as THREE from "three";
import SelectionEditDrag from "./selectionEditDrag";

// What one kind of selection offers to be edited by its outline (see SelectionEditGizmoUtil): handles to
// resize it by, its body to move it by, or both. Asked on every press and every frame, so each answer is for
// the selection as it stands, and is nothing while this kind has none this user may edit.
export default interface SelectionEditGizmoProvider
{
    // The handles, each named for what it resizes and placed in the world, in an order that holds for as
    // long as the selection does: only those a drag could resize the selection by, some way or other.
    getHandles: () => {id: string, position: THREE.Vector3}[];
    // The cursor over a handle, and the drag a press on it begins. handleScreen is where the handle shows,
    // in the viewport coordinates pointer events carry.
    pickHandle: (handleIndex: number, ev: PointerEvent, handleScreen: {x: number, y: number}) =>
        {cursor: string, begin: () => SelectionEditDrag};
    // The same for a press on no handle; null unless it lands on the selection's body and that can be moved.
    pickBody: (ev: PointerEvent) => {cursor: string, begin: () => SelectionEditDrag} | null;
    // The outline's middle and its corners in the world, with where each corner lies from the middle along
    // the face's right and up; null while there is nothing to grab. For automation.
    getOutline: () => {middle: THREE.Vector3, corners: {corner: {x: number, y: number}, position: THREE.Vector3}[]} | null;
}
