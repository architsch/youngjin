// A drag a gizmo has taken from the camera, fed the pointer until it ends (see GizmoDragUtil).
export default interface GizmoDragHandler
{
    // The pointer moved, once it has travelled far enough to count as a drag.
    onMove: (ev: PointerEvent) => void;
    // Released after dragging: keep the result.
    onEnd: () => void;
    // Released without dragging, or abandoned (a second finger, lost focus): undo whatever it did.
    onCancel: () => void;
}
