import { useMemo } from "react";
import { InstancedMeshCompositionBuilderMap } from "../../../../shared/graphics/mesh/composition/maps/instancedMeshCompositionBuilderMap";
import { InstancedMeshCompositionParams } from "../../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import IsometricProjectionUtil from "../util/isometricProjectionUtil";

//------------------------------------------------------------------------
// Shows the bare shape of one composition variant, so that a selector stepping
// through variants can say which shape it is currently on.
//
// The shape is taken from the same builder that assembles the real thing, which
// is what keeps the icon honest: a variant added to the builder map gets an icon
// for free, and a variant whose shape is reworked gets a reworked icon.
//------------------------------------------------------------------------

const VIEW_BOX_SIZE = 64;
const PADDING = 3;

// Monochrome, because a part's own color is already shown by the color input beside
// it — leaving the icon to speak only about shape. The shading has to carry the
// depth on its own, so the fills stay opaque: a nearer face must hide what stands
// behind it, which a translucent one would let through.
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
        // Built on its own, apart from the character: no slot placement and no
        // mirroring, so what is measured and drawn is the part's shape alone.
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
            // Each face is stroked in its own fill, which closes the hairline seams
            // that anti-aliasing would otherwise leave between neighboring faces.
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
