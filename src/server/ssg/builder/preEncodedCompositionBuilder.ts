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

// A value of -1 in the source marks a field the authored composition cannot settle, because it
// belongs to the individual object rather than to the drawing every object of that kind shares — a
// lamp's lit face takes its color from the light that particular lamp gives off.
//
// Such a field cannot be carried through the encoding: a composition string has a character for it
// either way, and the quantization clamps, so -1 would be stored as the bottom of the field's range
// and read back as a deliberate choice. What is written instead is a neutral placeholder that the
// object overwrites on the way in. White rather than black on purpose: if an object ever fails to
// overwrite it, a part that is plainly wrong is a bug somebody can see, where an unlit black one
// looks like a part that was never drawn.
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

// Turns the authored compositions into the table objects name their appearance out of.
//
// The point of doing this at build time is that it costs the client nothing: an appearance that would
// otherwise be either a long string stored on every object wearing it, or a hard-coded builder
// compiled into the bundle, becomes one entry in a generated array. Adding a variant is then an edit
// to data (see @docs/graphics/instanced_mesh_composition.md).
//
// Anything wrong in the source stops the build rather than being written out. A composition is read
// by every client and cannot be corrected once objects are stored against its index, and the failure
// modes here are all silent ones — an unknown geometry encodes as a character that reads back as a
// different shape entirely, with nothing at runtime to notice.
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

        // The prefix is added here rather than by the codec: every codec's encode writes its body
        // alone and its decode skips the two characters (see CompositionMetadataUtil).
        const codecVersion = entry.codecVersion ?? 0;
        const prefix = CompositionMetadataUtil.getCodecPrefix(codecType, codecVersion);

        if (codecType == InstancedMeshCompositionCodecTypeEnumMap.Default)
            return prefix + DefaultCompositionCodec.encode({}, this.parseDefaultParts(entry, compositionIndex));

        // The params-only codecs build their parts from a handful of authored choices rather than
        // from parts written down one by one, so each needs a parser of its own saying what those
        // choices are. None is needed yet.
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

            // The Default codec writes a color only for the materials that are tinted per instance,
            // and reads one back only for those — so a part is given one exactly when the codec is
            // going to look for it.
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
        // Written through JSON.stringify rather than wrapped in quotes: the encoding's alphabet is
        // every printable ASCII character, which includes the quote and the backslash.
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
