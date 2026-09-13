import { useMemo, useState } from "react";
import Text from "../basic/text";
import useWorldTapDismiss from "../../util/worldTapDismiss";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import DoorCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/doorCompositionParams";
import DoorCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import StepperInput from "../input/stepperInput";
import PaletteColorInput from "../input/paletteColorInput";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import createDeferredSave from "../../util/deferredSave";
import ScrollPanel from "./scrollPanel";

// Edits a door's three colours (timber, plate, knob) in place, rebuilding the door live. Uses the
// joinery palette (see ColorPaletteMap).

const COLOR_PALETTE_NAME = "Timber";

const colorSlots: {title: string, key: keyof DoorCompositionParams["colors"]}[] = [
    {title: "Timber", key: "panel"},
    {title: "Plate", key: "label"},
    {title: "Knob", key: "knob"},
];

export default function CustomizeDoorPanel({ selection, onClose }: Props)
{
    const [editCount, setEditCount] = useState(0);

    // A world tap closes this panel only; otherwise it would deselect the door.
    useWorldTapDismiss(onClose);

    // Re-read 'params' whenever 'editCount' changes.
    const params = useMemo(() => getDoorParams(selection), [selection, editCount]);
    if (params == undefined)
        return null;

    // Writes to the live params (compositions are reloaded on save; see InstancedMeshComposition).
    const applyEdit = (mutateParams: (liveParams: DoorCompositionParams) => void) => {
        const liveParams = getDoorParams(selection);
        if (liveParams == undefined)
            return;
        trySave(selection);
        mutateParams(liveParams);
        rebuildDoorParts(selection);
        setEditCount(prev => prev + 1);
    };

    // Applies a whole coordinated scheme as a starting point.
    const applyScheme = (schemeIndex: number) => applyEdit((p) => {
        const scheme = DoorCompositionConstants.colorSchemes[schemeIndex];
        p.colors.panel = {...scheme.panel};
        p.colors.label = {...scheme.label};
        p.colors.knob = {...scheme.knob};
    });

    return <ScrollPanel id="customizeDoorOptions" onClose={onClose} additionalClassNames="m-2">
        <div className="flex flex-col items-center gap-1 shrink-0">
            <Text content="Presets" size="sm"/>
            <StepperInput
                currValue={findMatchingScheme(params)}
                numValues={DoorCompositionConstants.colorSchemes.length}
                setValue={applyScheme}
            />
        </div>
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        {colorSlots.map((slot, slotIndex) =>
            <div key={"color-slot-" + slot.key} className="flex flex-row items-stretch gap-3 shrink-0">
                <div className="flex flex-row items-center gap-1 shrink-0">
                    <Text content={slot.title} size="sm"/>
                    <PaletteColorInput
                        paletteName={COLOR_PALETTE_NAME}
                        currValue={ColorUtil.rgbToPaletteIndex(COLOR_PALETTE_NAME, params.colors[slot.key])}
                        setColorIndex={(index: number) => applyEdit(
                            (p) => p.colors[slot.key] = ColorUtil.paletteIndexToRGB(COLOR_PALETTE_NAME, index))}
                    />
                </div>
                {slotIndex < colorSlots.length - 1 &&
                    <div className="w-px self-stretch bg-gray-500"/>}
            </div>
        )}
    </ScrollPanel>;
}

// The matching scheme index, or 0 for a hand-adjusted finish.
function findMatchingScheme(params: DoorCompositionParams): number
{
    const index = DoorCompositionConstants.colorSchemes.findIndex(scheme =>
        sameColor(scheme.panel, params.colors.panel) &&
        sameColor(scheme.label, params.colors.label) &&
        sameColor(scheme.knob, params.colors.knob));
    return index >= 0 ? index : 0;
}

function sameColor(a: {x: number, y: number, z: number}, b: {x: number, y: number, z: number}): boolean
{
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

// Batches rapid edits into one save.
const trySave = createDeferredSave((selection: ObjectSelection) =>
    doForDoor(selection, (c) => c.saveParts()));

// The live params object, so edits apply directly.
function getDoorParams(selection: ObjectSelection): DoorCompositionParams | undefined
{
    return doForDoor(selection, (c) => c.getParams()) as DoorCompositionParams | undefined;
}

// Rebuilds the door's parts from its current composition params.
function rebuildDoorParts(selection: ObjectSelection)
{
    doForDoor(selection, (c) => c.rebuildParts());
}

function doForDoor(selection: ObjectSelection, action: (composer: InstancedMeshComposer) => any)
{
    const composer = selection.gameObject.components.instancedMeshComposer as InstancedMeshComposer;
    if (!composer)
    {
        console.error(`CustomizeDoorPanel :: The selected door has no composer`);
        return undefined;
    }
    return action(composer);
}

interface Props
{
    selection: ObjectSelection;
    onClose: () => void;
}
