import { useMemo, useState } from "react";
import Text from "../basic/text";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import Vec3 from "../../../../shared/math/types/vec3";
import CanvasCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/canvasCompositionParams";
import CanvasCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/canvasCompositionConstants";
import StepperInput from "../input/stepperInput";
import Checkbox from "../input/checkbox";
import MarginInput from "../input/marginInput";
import MouldingInput from "../input/mouldingInput";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import createDeferredSave from "../../util/deferredSave";
import ScrollPanel from "./scrollPanel";

// Edits a canvas's look in place, rebuilding it live: how far inside its footprint it is drawn, and its
// frame's wood inputs (frame and inner colors, band width and profile).

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
        <MarginInput margin={params.margin}
            setMargin={(margin: number) => applyEdit((p) => p.margin = margin)}/>
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
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
            <MouldingInput
                colorSlots={colorSlots.map(slot => ({title: slot.title, color: params.colors[slot.key],
                    setColor: (color: Vec3) => applyEdit((p) => p.colors[slot.key] = color)}))}
                mouldingThickness={params.mouldingThickness}
                setMouldingThickness={(thickness: number) => applyEdit((p) => p.mouldingThickness = thickness)}
                mouldingIsConvex={params.mouldingIsConvex}
                setMouldingIsConvex={(convex: boolean) => applyEdit((p) => p.mouldingIsConvex = convex)}
            />
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
