import { useMemo } from "react";
import { InstancedMeshCompositionBuilderMap } from "../../../../shared/graphics/mesh/composition/maps/instancedMeshCompositionBuilderMap";
import { InstancedMeshCompositionParams } from "../../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import IsometricProjectionUtil from "../util/isometricProjectionUtil";

// Icon of one composition variant's shape, generated from the same builder as the real part.

const VIEW_BOX_SIZE = 64;
const PADDING = 3;

// Monochrome (color is shown separately); fills stay opaque so near faces hide far ones.
const BASE_COLOR = {r: 226, g: 232, b: 240};

export default function PartShapeIcon({ builderType, params, additionalClassNames = "" }: Props)
{
    const faces = useMemo(() => {
        const builder = InstancedMeshCompositionBuilderMap[builderType];
        if (builder == undefined)
        {
            console.error(`PartShapeIcon :: Composition builder not found (builderType = ${builderType})`);
            return [];
        }
        // Built alone (no slot placement or mirroring).
        const parts: InstancedMeshCompositionPart[] = [];
        builder(params, parts).run();
        return IsometricProjectionUtil.getFaces(parts, VIEW_BOX_SIZE, PADDING);
    }, [builderType, params]);

    return <svg viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}
        className={`size-8 ${additionalClassNames}`}>
        {faces.map((face, faceIndex) => {
            const color = `rgb(${Math.round(BASE_COLOR.r * face.shade)}, `
                + `${Math.round(BASE_COLOR.g * face.shade)}, `
                + `${Math.round(BASE_COLOR.b * face.shade)})`;
            // Stroke in the fill colour to close anti-aliasing seams.
            return <path key={faceIndex} d={face.d} fill={color}
                stroke={color} strokeWidth="0.5" strokeLinejoin="round"/>;
        })}
    </svg>
}

interface Props
{
    // Key into InstancedMeshCompositionBuilderMap (e.g. "PlayerArm_1").
    builderType: string;
    params: InstancedMeshCompositionParams;
    additionalClassNames?: string;
}
