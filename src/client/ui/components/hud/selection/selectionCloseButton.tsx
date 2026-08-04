import { useEffect, useReducer } from "react";
import IconButton from "../../input/iconButton";
import CloseIcon from "../../../svg/icons/closeIcon";
import ObjectSelection from "../../../../graphics/types/gizmo/objectSelection";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import WorldSpaceSelectionUtil from "../../../../graphics/util/worldSpaceSelectionUtil";
import { clientFeatureFlagsObservable, objectSelectionObservable,
    voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";

// Feature flags whose toggling changes whether the current selection can be dropped at all.
const selectionFeatureFlags = [
    FeatureFlag.DisableAllSelectionChange,
    FeatureFlag.DisableVoxelQuadSelectionChange,
    FeatureFlag.DisableObjectSelectionChange,
];

//------------------------------------------------------------------------
// Lets the user put the current selection down — which, for a user who may edit the room, is also
// what gives him back the first-person view and the run of the room, since the camera orbits
// whatever is selected for as long as something is.
//------------------------------------------------------------------------

export default function SelectionCloseButton()
{
    const [, forceRefresh] = useReducer((x: number) => x + 1, 0);

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.selectionCloseButton", forceRefresh);
        objectSelectionObservable.addListener("ui.selectionCloseButton", forceRefresh);
        for (const flag of selectionFeatureFlags)
            clientFeatureFlagsObservable.addElementListener("ui.selectionCloseButton", flag, forceRefresh);
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.selectionCloseButton");
            objectSelectionObservable.removeListener("ui.selectionCloseButton");
            for (const flag of selectionFeatureFlags)
                clientFeatureFlagsObservable.removeElementListener("ui.selectionCloseButton", flag);
        };
    }, []);

    if (!selectionCanBeDropped())
        return null;

    return <div className="flex flex-row px-2 pb-1">
        <IconButton id="closeSelectionButton" icon={<CloseIcon/>} size="sm"
            onClick={() => WorldSpaceSelectionUtil.unselectAll()}
            additionalClassNames="pointer-events-auto"/>
    </div>;
}

// Whether there is a selection to drop and the user is free to drop it. A single-player step may be
// holding a selection in place on purpose, and a button that would do nothing when pressed is worse
// than no button at all.
function selectionCanBeDropped(): boolean
{
    if (clientFeatureFlagsObservable.has(FeatureFlag.DisableAllSelectionChange))
        return false;
    if (VoxelQuadSelection.isSelected() &&
        !clientFeatureFlagsObservable.has(FeatureFlag.DisableVoxelQuadSelectionChange))
    {
        return true;
    }
    return ObjectSelection.isSelected() &&
        !clientFeatureFlagsObservable.has(FeatureFlag.DisableObjectSelectionChange);
}
