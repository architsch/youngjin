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

//------------------------------------------------------------------------
// This panel finishes a door, by editing the three colours its appearance is made of — the timber,
// the plate its name is written on, and the knob. It works the way the player-customization panel
// does: the params the door is composed of are edited in place and the door rebuilt from them, so
// what the user sees is the door itself changing rather than a preview of it.
//
// The colours come from the timber palette rather than the general one: a door is joinery, and the
// finishes a toy is painted in are not finishes a door was ever given (see ColorPaletteMap).
//------------------------------------------------------------------------

const COLOR_PALETTE_NAME = "Timber";

const colorSlots: {title: string, key: keyof DoorCompositionParams["colors"]}[] = [
    {title: "Timber", key: "panel"},
    {title: "Plate", key: "label"},
    {title: "Knob", key: "knob"},
];

export default function CustomizeDoorPanel({ selection, onClose }: Props)
{
    const [editCount, setEditCount] = useState(0);

    // A tap on the room puts this panel away and goes no further. Left to reach the room, that tap
    // would drop the very door being painted — taking the panel with it, since the panel belongs to
    // the selection — so putting the panel down would quietly cost the user his place as well.
    useWorldTapDismiss(onClose);

    // Re-read 'params' whenever 'editCount' changes.
    const params = useMemo(() => getDoorParams(selection), [selection, editCount]);
    if (params == undefined)
        return null;

    // The edit is written to the params the door is composed of at this moment, rather than to the
    // ones this render read: a composition is reloaded whenever it is saved, so the two are only the
    // same object for as long as nobody has swapped it (see InstancedMeshComposition).
    const applyEdit = (mutateParams: (liveParams: DoorCompositionParams) => void) => {
        const liveParams = getDoorParams(selection);
        if (liveParams == undefined)
            return;
        trySave(selection);
        mutateParams(liveParams);
        rebuildDoorParts(selection);
        setEditCount(prev => prev + 1);
    };

    // A whole finish at once, drawn from the coordinated schemes a door can be given. Three colours
    // picked independently rarely look like a door somebody painted, so the quickest way to a good
    // one is to take a scheme and adjust it rather than to start from nothing.
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

// Which of the authored schemes the door is currently wearing, or the first one if it is wearing a
// finish of its own. The stepper has to start somewhere, and a door whose colours were adjusted by
// hand is not any of them — stepping from the first is as good a place to resume as any.
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

// Painting a door is a run of small edits — a scheme, then a colour, then another — and each one
// rewrites the whole composition, so they are written down together rather than one at a time.
const trySave = createDeferredSave((selection: ObjectSelection) =>
    doForDoor(selection, (c) => c.saveParts()));

// Reads the selected door's composition params (the live object, so that edits can be applied to it
// directly).
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
