import { useMemo, useState } from "react";
import Text from "../basic/text";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import Vec3 from "../../../../shared/math/types/vec3";
import CanvasCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/canvasCompositionParams";
import CanvasCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/canvasCompositionConstants";
import StepperInput from "../input/stepperInput";
import Checkbox from "../input/checkbox";
import PaletteColorInput from "../input/paletteColorInput";
import RangeInput from "../input/rangeInput";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import createDeferredSave from "../../util/deferredSave";
import ScrollPanel from "./scrollPanel";

// Edits a canvas frame's wood inputs (frame and inner colors, band width and profile) in place,
// rebuilding the frame live. Uses the joinery palette, as doors do (see ColorPaletteMap).

const COLOR_PALETTE_NAME = "Timber";

const colorSlots: {title: string, key: keyof CanvasCompositionParams["colors"]}[] = [
    {title: "Frame", key: "frame"},
    {title: "Inner", key: "inner"},
];

export default function CustomizeCanvasPanel({ selection, onClose }: Props)
{
    const [editCount, setEditCount] = useState(0);

    // Re-read 'params' whenever 'editCount' changes.
    const params = useMemo(() => getCanvasParams(selection), [selection, editCount]);
    if (params == undefined)
        return null;

    // Writes to the live params (compositions are reloaded on save; see InstancedMeshComposition).
    const applyEdit = (mutateParams: (liveParams: CanvasCompositionParams) => void) => {
        const liveParams = getCanvasParams(selection);
        if (liveParams == undefined)
            return;
        trySave(selection);
        mutateParams(liveParams);
        rebuildCanvasParts(selection);
        setEditCount(prev => prev + 1);
    };

    const presets = CanvasCompositionConstants.presets;
    // Applies a whole preset as a starting point.
    const applyPreset = (presetIndex: number) => applyEdit((p) => {
        const preset = presets[presetIndex];
        p.colors.frame = {...preset.colors.frame};
        p.colors.inner = {...preset.colors.inner};
        p.mouldingThickness = preset.mouldingThickness;
        p.mouldingIsConvex = preset.mouldingIsConvex;
    });

    return <ScrollPanel id="customizeCanvasOptions" onClose={onClose} additionalClassNames="m-2">
        <Checkbox label="Frame On" size="sm" checked={params.framed}
            onChange={(checked: boolean) => applyEdit((p) => p.framed = checked)} additionalClassNames="shrink-0"/>
        {params.framed && <>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            <div className="flex flex-col items-center gap-1 shrink-0">
                <Text content="Presets" size="sm"/>
                <StepperInput
                    currValue={findMatchingPreset(params)}
                    numValues={presets.length}
                    setValue={applyPreset}
                />
            </div>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            {colorSlots.map(slot =>
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
                    <div className="w-px self-stretch bg-gray-500"/>
                </div>
            )}
            <div className="flex flex-col items-center gap-1 shrink-0">
                <Text content="Thickness" size="sm"/>
                {/* Judged by eye, so no value field (see RangeInput). */}
                <RangeInput
                    currValue={String(params.mouldingThickness)}
                    setValue={(value: string) => applyEdit((p) => p.mouldingThickness = Number(value))}
                    min={String(CanvasCompositionConstants.minMouldingThickness)}
                    max={String(CanvasCompositionConstants.maxMouldingThickness)}
                    step={String(CanvasCompositionConstants.mouldingThicknessStep)}
                    showValueInput={false}
                    additionalClassNames="w-28"
                />
            </div>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            <div className="flex flex-col items-center gap-1 shrink-0">
                <Text content="Profile" size="sm"/>
                <StepperInput
                    currValue={params.mouldingIsConvex ? 0 : 1}
                    numValues={2}
                    setValue={(value: number) => applyEdit((p) => p.mouldingIsConvex = (value == 0))}
                    labels={["Convex", "Concave"]}
                />
            </div>
        </>}
    </ScrollPanel>;
}

// The matching preset index, or -1 for a hand-adjusted finish.
function findMatchingPreset(params: CanvasCompositionParams): number
{
    return CanvasCompositionConstants.presets.findIndex(preset =>
        sameColor(preset.colors.frame, params.colors.frame) &&
        sameColor(preset.colors.inner, params.colors.inner) &&
        preset.mouldingThickness === params.mouldingThickness &&
        preset.mouldingIsConvex === params.mouldingIsConvex);
}

function sameColor(a: Vec3, b: Vec3): boolean
{
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

// Batches rapid edits into one save per canvas.
const trySave = createDeferredSave((selection: ObjectSelection) =>
    doForCanvas(selection, (c) => c.saveParts()), (selection) => selection.gameObject);

// The live params object, so edits apply directly.
function getCanvasParams(selection: ObjectSelection): CanvasCompositionParams | undefined
{
    return doForCanvas(selection, (c) => c.getParams()) as CanvasCompositionParams | undefined;
}

// Rebuilds the canvas's parts from its current composition params.
function rebuildCanvasParts(selection: ObjectSelection)
{
    doForCanvas(selection, (c) => c.rebuildParts());
}

function doForCanvas(selection: ObjectSelection, action: (composer: InstancedMeshComposer) => any)
{
    const composer = selection.gameObject.components.instancedMeshComposer as InstancedMeshComposer;
    if (!composer)
    {
        console.error(`CustomizeCanvasPanel :: The selected canvas has no composer`);
        return undefined;
    }
    return action(composer);
}

interface Props
{
    selection: ObjectSelection;
    onClose: () => void;
}
