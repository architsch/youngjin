import { useMemo, useState } from "react";
import Text from "../basic/text";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import Vec3 from "../../../../shared/math/types/vec3";
import FramedPanelCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/framedPanelCompositionParams";
import FramedPanelPreset from "../../../../shared/graphics/mesh/composition/types/compositionParams/framedPanelPreset";
import FramedPanelCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import StepperInput from "../input/stepperInput";
import Checkbox from "../input/checkbox";
import MarginInput from "../input/marginInput";
import MouldingInput from "../input/mouldingInput";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import createDeferredSave from "../../util/deferredSave";
import ScrollPanel from "./scrollPanel";

// Edits a framed panel's look in place (a canvas or a label), rebuilding it live: its presets, how
// far inside its footprint it is drawn, and its optional frame's wood inputs (see
// FramedPanelCompositionConstants).
export default function CustomizeFramePanel({ id, selection, colorSlots, presets, onClose }: Props)
{
    const [editCount, setEditCount] = useState(0);

    // Re-read 'params' whenever 'editCount' changes.
    const params = useMemo(() => getParams(selection), [selection, editCount]);
    if (params == undefined)
        return null;

    // Writes to the live params (compositions are reloaded on save; see InstancedMeshComposition).
    const applyEdit = (mutateParams: (liveParams: FramedPanelCompositionParams) => void) => {
        const liveParams = getParams(selection);
        if (liveParams == undefined)
            return;
        trySave(selection);
        mutateParams(liveParams);
        doForComposer(selection, (composer) => composer.rebuildParts());
        setEditCount(prev => prev + 1);
    };

    // Presets that are a finish alone mean something only on a frame that is shown.
    const presetsSetTheFrame = presets.every(preset => preset.framed != undefined);

    return <ScrollPanel id={id} onClose={onClose} additionalClassNames="m-2">
        {(presetsSetTheFrame || params.framed) && <>
            <div className="flex flex-col items-center gap-1 shrink-0">
                <Text content="Presets" size="sm"/>
                <StepperInput
                    currValue={findMatchingPreset(params, presets)}
                    numValues={presets.length}
                    setValue={(presetIndex: number) => applyEdit((p) =>
                        FramedPanelCompositionConstants.applyPreset(p, presets[presetIndex]))}
                />
            </div>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        </>}
        <MarginInput margin={params.margin}
            setMargin={(margin: number) => applyEdit((p) => p.margin = margin)}/>
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        <Checkbox label="Frame On" size="sm" checked={params.framed}
            onChange={(checked: boolean) => applyEdit((p) => p.framed = checked)} additionalClassNames="shrink-0"/>
        {params.framed && <>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            <MouldingInput
                colorSlots={colorSlots.map(slot => ({title: slot.title, color: params.colors[slot.key]!,
                    setColor: (color: Vec3) => applyEdit((p) => p.colors[slot.key] = color)}))}
                mouldingThickness={params.mouldingThickness}
                setMouldingThickness={(thickness: number) => applyEdit((p) => p.mouldingThickness = thickness)}
                mouldingIsConvex={params.mouldingIsConvex}
                setMouldingIsConvex={(convex: boolean) => applyEdit((p) => p.mouldingIsConvex = convex)}
            />
        </>}
    </ScrollPanel>;
}

// The matching preset index, or -1 for a hand-adjusted look. A finish on a frame that isn't shown
// doesn't count, and neither does what a preset leaves out.
function findMatchingPreset(params: FramedPanelCompositionParams, presets: FramedPanelPreset[]): number
{
    return presets.findIndex(preset =>
        (preset.framed == undefined || preset.framed === params.framed) &&
        (preset.margin == undefined || preset.margin === params.margin) &&
        (!params.framed || (
            sameColor(preset.colors.frame, params.colors.frame) &&
            sameColor(preset.colors.inner, params.colors.inner) &&
            preset.mouldingThickness === params.mouldingThickness &&
            preset.mouldingIsConvex === params.mouldingIsConvex)));
}

function sameColor(a: Vec3 | undefined, b: Vec3 | undefined): boolean
{
    return a?.x === b?.x && a?.y === b?.y && a?.z === b?.z;
}

// Batches rapid edits into one save per object.
const trySave = createDeferredSave((selection: ObjectSelection) =>
    doForComposer(selection, (composer) => composer.saveParts()), (selection) => selection.gameObject);

// The live params object, so edits apply directly.
function getParams(selection: ObjectSelection): FramedPanelCompositionParams | undefined
{
    return doForComposer(selection, (composer) => composer.getParams()) as FramedPanelCompositionParams | undefined;
}

function doForComposer(selection: ObjectSelection, action: (composer: InstancedMeshComposer) => any)
{
    const composer = selection.gameObject.components.instancedMeshComposer as InstancedMeshComposer;
    if (!composer)
    {
        console.error(`CustomizeFramePanel :: The selected object has no composer`);
        return undefined;
    }
    return action(composer);
}

interface Props
{
    // Lets automation address this panel (e.g. "customizeCanvasOptions").
    id: string;
    selection: ObjectSelection;
    // The colors the panel offers, each with its heading; "inner" only where the board shows inside its band.
    colorSlots: {title: string, key: "frame" | "inner"}[];
    presets: FramedPanelPreset[];
    onClose: () => void;
}
