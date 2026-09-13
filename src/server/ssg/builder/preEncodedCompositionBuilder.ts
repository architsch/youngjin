import FileUtil from "../util/fileUtil";
import { STATIC_PAGE_ROOT_DIR, SRC_ROOT_DIR } from "../../system/serverConstants";
import { DefaultCompositionCodec } from "../../../shared/graphics/mesh/composition/types/compositionCodec/defaultCompositionCodec";
import CompositionMetadataUtil from "../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import Vec3 from "../../../shared/math/types/vec3";
import { GEOMETRY_CODE_BY_ID, INSTANCE_COLORED_MATERIAL_IDS,
    MATERIAL_CODE_BY_ID } from "../../../shared/system/sharedConstants";

const SOURCE_ROOT_PATH = `${STATIC_PAGE_ROOT_DIR}/app/assets/instanced_mesh_composition`;
const SOURCE_FILE_NAME = "pre_encoding_source.json";
const MAPS_ROOT_PATH = `${SRC_ROOT_DIR}/shared/graphics/mesh/composition/maps`;
const MAP_FILE_NAME = "preEncodedCompositionStringMap.ts";

// -1 in the source marks a per-object field (e.g. a lamp face's color, set from its light). It can't
// survive encoding (clamping would store a real value), so a white placeholder is written for the
// object to overwrite; white makes a missed overwrite visibly wrong rather than looking undrawn.
const INDETERMINATE = -1;
const INDETERMINATE_COLOR_CHANNEL = 255;

type PreEncodingSourcePart = {
    geometryId: string,
    materialId: string,
    dir: Vec3,
    offset: Vec3,
    scale: Vec3,
    color?: Vec3,
};

type PreEncodingSourceEntry = {
    comment?: string,
    codecType: string,
    codecVersion?: number,
    parts: PreEncodingSourcePart[],
};

// Encodes authored compositions into the generated indexed table at build time (see
// @docs/graphics/instanced_mesh_composition.md). Any source error fails the build, since bad entries
// fail silently at runtime and can't be fixed once objects reference their index.
export default class PreEncodedCompositionBuilder
{
    async build(): Promise<void>
    {
        const sourceJSON = await FileUtil.read(SOURCE_FILE_NAME, SOURCE_ROOT_PATH);
        const source = JSON.parse(sourceJSON) as {compositions: PreEncodingSourceEntry[]};

        const encodedStrings = source.compositions.map(
            (entry, compositionIndex) => this.encodeComposition(entry, compositionIndex));

        await this.writeMapFile(encodedStrings);
    }

    private encodeComposition(entry: PreEncodingSourceEntry, compositionIndex: number): string
    {
        const codecType = InstancedMeshCompositionCodecTypeEnumMap[entry.codecType];
        if (codecType == undefined)
            throw new Error(`Composition pre-encoding failed :: Unknown codecType "${entry.codecType}" (compositionIndex = ${compositionIndex})`);

        // Codecs encode bodies only; the prefix is added here (see CompositionMetadataUtil).
        const codecVersion = entry.codecVersion ?? 0;
        const prefix = CompositionMetadataUtil.getCodecPrefix(codecType, codecVersion);

        if (codecType == InstancedMeshCompositionCodecTypeEnumMap.Default)
            return prefix + DefaultCompositionCodec.encode({}, this.parseDefaultParts(entry, compositionIndex));

        // Params-only codecs would each need their own parser; none is needed yet.
        throw new Error(`Composition pre-encoding failed :: codecType "${entry.codecType}" cannot be pre-encoded yet (compositionIndex = ${compositionIndex})`);
    }

    private parseDefaultParts(entry: PreEncodingSourceEntry,
        compositionIndex: number): InstancedMeshCompositionPart[]
    {
        return entry.parts.map((part, partIndex) => {
            const where = `compositionIndex = ${compositionIndex}, partIndex = ${partIndex}`;
            if (GEOMETRY_CODE_BY_ID[part.geometryId] == undefined)
                throw new Error(`Composition pre-encoding failed :: Unknown geometryId "${part.geometryId}" (${where})`);
            if (MATERIAL_CODE_BY_ID[part.materialId] == undefined)
                throw new Error(`Composition pre-encoding failed :: Unknown materialId "${part.materialId}" (${where})`);

            const composedPart: InstancedMeshCompositionPart = {
                instancedMeshId: MeshDataUtil.getInstancedMeshId(part.geometryId, part.materialId),
                dir: part.dir,
                offset: part.offset,
                scale: part.scale,
            };

            // The Default codec only writes/reads colors for instance-colored materials.
            if (INSTANCE_COLORED_MATERIAL_IDS.includes(part.materialId))
            {
                if (part.color == undefined)
                    throw new Error(`Composition pre-encoding failed :: Material "${part.materialId}" is tinted per instance and needs a color (${where})`);
                composedPart.color = resolveIndeterminateColor(part.color);
            }
            return composedPart;
        });
    }

    private async writeMapFile(encodedStrings: string[]): Promise<void>
    {
        // JSON.stringify, since the alphabet includes quotes and backslashes.
        const entries = encodedStrings.map(str => JSON.stringify(str)).join(",");

        const text = `// THIS FILE IS AUTO-GENERATED BY PreEncodedCompositionBuilder. DO NOT EDIT MANUALLY.
const PreEncodedCompositionStringMap: string[] = [${entries}];

export default PreEncodedCompositionStringMap;
`;
        await FileUtil.write(MAP_FILE_NAME, text, MAPS_ROOT_PATH);
    }
}

function resolveIndeterminateColor(color: Vec3): Vec3
{
    return {
        x: color.x == INDETERMINATE ? INDETERMINATE_COLOR_CHANNEL : color.x,
        y: color.y == INDETERMINATE ? INDETERMINATE_COLOR_CHANNEL : color.y,
        z: color.z == INDETERMINATE ? INDETERMINATE_COLOR_CHANNEL : color.z,
    };
}
