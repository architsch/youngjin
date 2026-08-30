import { useMemo, useState } from "react";
import Text from "../basic/text";
import IconButton from "../input/iconButton";
import CloseIcon from "../../svg/icons/closeIcon";
import useMouseDragScroll from "../../util/mouseDragScroll";
import useWorldTapDismiss from "../../util/worldTapDismiss";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import DoorCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/doorCompositionParams";
import DoorCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import StepperInput from "../input/stepperInput";
import PaletteColorInput from "../input/paletteColorInput";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";

//------------------------------------------------------------------------
// This form finishes a door, by editing the three colours its appearance is made of — the timber,
// the plate its name is written on, and the knob. It works the way the player-customization form
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

export default function CustomizeDoorForm({ selection, onClose }: Props)
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");
    const [editCount, setEditCount] = useState(0);

    // A tap on the room puts this bar away and goes no further. Left to reach the room, that tap
    // would drop the very door being painted — taking the bar with it, since the bar belongs to the
    // selection — so putting the bar down would quietly cost the user his place as well.
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

    // The close button stands above the panel rather than inside it, so the panel is exactly as tall
    // as the controls it holds — a slab of background reaching up past them to enclose a button reads
    // as a panel with a gap in it.
    return <div className="m-2 flex flex-col gap-1 items-start">
        <IconButton icon={<CloseIcon/>} size="sm" onClick={onClose}/>
        <div id="customizeDoorOptions" className="p-2 flex flex-col gap-1 max-h-[30vh] w-full bg-gray-700 rounded-lg pointer-events-auto yj-surface-convex">
            <div ref={onRefChange} className="flex flex-row items-stretch gap-3 w-full overflow-x-auto no-scrollbar">
                <div className="flex flex-col items-center gap-1 shrink-0">
                    <Text content="Presets" size="sm"/>
                    <StepperInput
                        currValue={findMatchingScheme(params)}
                        numValues={DoorCompositionConstants.colorSchemes.length}
                        setValue={applyScheme}
                    />
                </div>
                <div className="w-px self-stretch bg-gray-500"/>
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
            </div>
        </div>
    </div>;
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

let saveDoorPartsTimeout: ReturnType<typeof setTimeout> | undefined;
function trySave(selection: ObjectSelection)
{
    if (!saveDoorPartsTimeout)
    {
        // Prevent parameter changes from triggering the save-operation too often.
        // One save per 2-second interval is enough.
        saveDoorPartsTimeout = setTimeout(() => {
            doForDoor(selection, (c) => c.saveParts());
            saveDoorPartsTimeout = undefined;
        }, 2000);
    }
}

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
        console.error(`CustomizeDoorForm :: The selected door has no composer`);
        return undefined;
    }
    return action(composer);
}

interface Props
{
    selection: ObjectSelection;
    onClose: () => void;
}
