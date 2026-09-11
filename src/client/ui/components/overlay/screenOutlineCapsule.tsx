import { CSSProperties, useEffect, useState } from "react";
import { screenOutlineCapsuleTargetObservable } from "../../../system/clientObservables";
import useTrackedElementRect from "../../util/trackedElementRect";

const OUTLINE_GAP_PX = 1; // how far outside the target's edges the outline's inner edge sits

// A 2D capsule-shaped outline overlay (a box whose two ends are rounded into half-circles) that
// surrounds a target UI element to highlight it, pulsing and glowing the way the rectangular one
// does (see ScreenOutlineRect). It is meant for a pill-shaped control, such as a switch's track,
// which a rectangle would fit only loosely, gaping at the corners. The target is identified by its
// DOM element id, which is supplied via screenOutlineCapsuleTargetObservable along with the outline's
// thickness; the outline tracks the element as it moves.
//
// A control of that shape tends to be a small one, which is why the thickness is supplied rather
// than fixed: a line as heavy as the rectangle's, with a glow to match, would swallow it. The glow
// is scaled along with the line (see the pulse-strong animation in input.css). And rather than
// overlapping its target as the rectangle does, the outline hugs it from the outside, leaving the
// dark rim that keeps a small control legible over the scene in plain sight.
export default function ScreenOutlineCapsule()
{
    const [outlineParams, setOutlineParams] = useState<{targetElementId: string,
        thicknessPx: number} | null>(null);

    useEffect(() => {
        screenOutlineCapsuleTargetObservable.addListener("ui.screenOutlineCapsule", setOutlineParams);
        return () => screenOutlineCapsuleTargetObservable.removeListener("ui.screenOutlineCapsule");
    }, []);

    const rect = useTrackedElementRect(outlineParams?.targetElementId ?? null);
    if (!outlineParams || !rect)
        return null;

    const {thicknessPx} = outlineParams;
    const reach = OUTLINE_GAP_PX + thicknessPx; // from the target's edges out to the outline's outer edge

    return <div className="absolute z-50 box-border rounded-full border-amber-400 animate-pulse-strong pointer-events-none"
        style={{
            left: rect.left - reach,
            top: rect.top - reach,
            width: rect.width + 2 * reach,
            height: rect.height + 2 * reach,
            borderWidth: thicknessPx,
            "--yj-outline-thickness": `${thicknessPx}px`,
        } as CSSProperties}/>;
}
