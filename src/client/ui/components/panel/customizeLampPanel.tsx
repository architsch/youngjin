import { useMemo, useState } from "react";
import Text from "../basic/text";
import InstancedMeshComposer from "../../../object/components/instancedMeshComposer";
import Vec3 from "../../../../shared/math/types/vec3";
import LampCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/lampCompositionParams";
import LampCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/lampCompositionConstants";
import StepperInput from "../input/stepperInput";
import Checkbox from "../input/checkbox";
import MarginInput from "../input/marginInput";
import MouldingInput from "../input/mouldingInput";
import ObjectSelection from "../../../graphics/types/gizmo/objectSelection";
import createDeferredSave from "../../util/deferredSave";
import ScrollPanel from "./scrollPanel";

// Edits a lamp's look in place, rebuilding it live: how far inside its footprint it is drawn, and its
// optional frame. The glow's color is the light's (see LampEditOptions).
export default function CustomizeLampPanel({ selection, onClose }: Props)
{
    const [editCount, setEditCount] = useState(0);

    // Re-read 'params' whenever 'editCount' changes.
    const params = useMemo(() => getLampParams(selection), [selection, editCount]);
    if (params == undefined)
        return null;

    // Writes to the live params (compositions are reloaded on save; see InstancedMeshComposition).
    const applyEdit = (mutateParams: (liveParams: LampCompositionParams) => void) => {
        const liveParams = getLampParams(selection);
        if (liveParams == undefined)
            return;
        trySave(selection);
        mutateParams(liveParams);
        rebuildLampParts(selection);
        setEditCount(prev => prev + 1);
    };

    const presets = LampCompositionConstants.presets;
    // Applies a whole preset as a starting point.
    const applyPreset = (presetIndex: number) => applyEdit((p) => {
        const preset = presets[presetIndex];
        p.colors.frame = {...preset.colors.frame};
        p.mouldingThickness = preset.mouldingThickness;
        p.mouldingIsConvex = preset.mouldingIsConvex;
        p.framed = preset.framed;
        p.margin = preset.margin;
    });

    return <ScrollPanel id="customizeLampOptions" onClose={onClose} additionalClassNames="m-2">
        <div className="flex flex-col items-center gap-1 shrink-0">
            <Text content="Presets" size="sm"/>
            <StepperInput
                currValue={findMatchingPreset(params)}
                numValues={presets.length}
                setValue={applyPreset}
            />
        </div>
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        <MarginInput margin={params.margin}
            setMargin={(margin: number) => applyEdit((p) => p.margin = margin)}/>
        <div className="w-px self-stretch shrink-0 bg-gray-500"/>
        <Checkbox label="Frame On" size="sm" checked={params.framed}
            onChange={(checked: boolean) => applyEdit((p) => p.framed = checked)} additionalClassNames="shrink-0"/>
        {params.framed && <>
            <div className="w-px self-stretch shrink-0 bg-gray-500"/>
            <MouldingInput
                colorSlots={[{title: "Frame", color: params.colors.frame,
                    setColor: (color: Vec3) => applyEdit((p) => p.colors.frame = color)}]}
                mouldingThickness={params.mouldingThickness}
                setMouldingThickness={(thickness: number) => applyEdit((p) => p.mouldingThickness = thickness)}
                mouldingIsConvex={params.mouldingIsConvex}
                setMouldingIsConvex={(convex: boolean) => applyEdit((p) => p.mouldingIsConvex = convex)}
            />
        </>}
    </ScrollPanel>;
}

// The matching preset index, or -1 for a hand-adjusted look. A frame that isn't shown doesn't count.
function findMatchingPreset(params: LampCompositionParams): number
{
    return LampCompositionConstants.presets.findIndex(preset =>
        preset.framed === params.framed && preset.margin === params.margin &&
        (!preset.framed || (
            sameColor(preset.colors.frame, params.colors.frame) &&
            preset.mouldingThickness === params.mouldingThickness &&
            preset.mouldingIsConvex === params.mouldingIsConvex)));
}

function sameColor(a: Vec3, b: Vec3): boolean
{
    return a.x === b.x && a.y === b.y && a.z === b.z;
}

// Batches rapid edits into one save per lamp.
const trySave = createDeferredSave((selection: ObjectSelection) =>
    doForLamp(selection, (c) => c.saveParts()), (selection) => selection.gameObject);

// The live params object, so edits apply directly.
function getLampParams(selection: ObjectSelection): LampCompositionParams | undefined
{
    return doForLamp(selection, (c) => c.getParams()) as LampCompositionParams | undefined;
}

// Rebuilds the lamp's parts from its current composition params.
function rebuildLampParts(selection: ObjectSelection)
{
    doForLamp(selection, (c) => c.rebuildParts());
}

function doForLamp(selection: ObjectSelection, action: (composer: InstancedMeshComposer) => any)
{
    const composer = selection.gameObject.components.instancedMeshComposer as InstancedMeshComposer;
    if (!composer)
    {
        console.error(`CustomizeLampPanel :: The selected lamp has no composer`);
        return undefined;
    }
    return action(composer);
}

interface Props
{
    selection: ObjectSelection;
    onClose: () => void;
}
