// One drag of the selection by its outline, as its kind carries it out (see SelectionEditGizmoUtil, which
// holds the view still while it lasts and ends it when it can't go on).
export default interface SelectionEditDrag
{
    // The handle held (see SelectionEditGizmoProvider.getHandles), shown larger meanwhile; undefined when the
    // selection's body is.
    handleId?: string;
    // The pointer moved, far enough for this to be a drag: preview the edit locally. Returns whether the
    // selection could do what the pointer now asks; while it can't, its outline and handles show red.
    onMove: (ev: PointerEvent) => boolean;
    // The drag is over, having moved: keep what it did and report it, or put everything back.
    onFinish: (keep: boolean) => void;
    // After that, once the view follows the selection again.
    onReleased?: () => void;
}
