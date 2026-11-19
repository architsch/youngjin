import { CSSProperties, useEffect, useState } from "react";
import { screenOutlineCapsuleTargetObservable } from "../../../system/clientObservables";
import useTrackedElementRect from "../../util/trackedElementRect";

const OUTLINE_GAP_PX = 1; // how far outside the target's edges the outline's inner edge sits

// Pulsing capsule outline for pill-shaped controls (screenOutlineCapsuleTargetObservable), with a
// configurable thickness for small targets (glow scales with it; see pulse-strong in input.css).
// Hugs the target from outside so its dark rim stays visible.
export default function ScreenOutlineCapsule()
{
    const [outlineParams, setOutlineParams] = useState<{targetElementId: string,
        thicknessPx: number} | null>(null);

    useEffect(() => {
        screenOutlineCapsuleTargetObservable.addListener("ui.screenOutlineCapsule", setOutlineParams);
        return () => screenOutlineCapsuleTargetObservable.removeListener("ui.screenOutlineCapsule");
    }, []);

    const rect = useTrackedElementRect(outlineParams?.targetElementId ?? null, true);
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
