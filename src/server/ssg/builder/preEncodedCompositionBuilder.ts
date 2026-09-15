import FileUtil from "../util/fileUtil";
import { STATIC_PAGE_ROOT_DIR, SRC_ROOT_DIR } from "../../system/serverConstants";
import { DefaultCompositionCodec } from "../../../shared/graphics/mesh/composition/types/compositionCodec/defaultCompositionCodec";
import CompositionMetadataUtil from "../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import MeshDataUtil from "../../../shared/graphics/mesh/util/meshDataUtil";
import Vec3 from "../../../shared/math/types/vec3";
import ObjectTypeConfigMap from "../../../shared/object/maps/objectTypeConfigMap";
import PreEncodedCompositions from "../types/preEncodedCompositions";
import { GEOMETRY_CODE_BY_ID, INSTANCE_COLORED_MATERIAL_IDS, INSTANCED_WOOD_MATERIAL_ID,
    MATERIAL_CODE_BY_ID } from "../../../shared/system/sharedConstants";

const SOURCE_ROOT_PATH = `${STATIC_PAGE_ROOT_DIR}/app/assets/instanced_mesh_composition`;
const SOURCE_FILE_NAME = "pre_encoding_source.json";
const MAPS_ROOT_PATH = `${SRC_ROOT_DIR}/shared/graphics/mesh/composition/maps`;
const STRING_MAP_FILE_NAME = "preEncodedCompositionStringMap.ts";
const INDEX_MAP_FILE_NAME = "preEncodedCompositionIndexMap.ts";

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
    mouldingColor?: Vec3,
    mouldingThickness?: number,
    mouldingIsConvex?: boolean,
};

type PreEncodingSourceEntry = {
    comment?: string,
    objectType: string,
    codecType: string,
    codecVersion?: number,
    parts: PreEncodingSourcePart[],
};

// Encodes authored compositions into the generated indexed tables at build time (see
// @docs/graphics/instanced_mesh_composition.md). Any source error fails the build, since bad entries
// fail silently at runtime and can't be fixed once objects reference their index.
export default class PreEncodedCompositionBuilder
{
    // Returns what it wrote, since the running (compiled) app still holds the previous tables.
    async build(): Promise<PreEncodedCompositions>
    {
        const sourceJSON = await FileUtil.read(SOURCE_FILE_NAME, SOURCE_ROOT_PATH);
        const source = JSON.parse(sourceJSON) as {compositions: PreEncodingSourceEntry[]};

        const encodedStrings: string[] = [];
        const indicesByObjectType: {[objectType: string]: number[]} = {};
        source.compositions.forEach((entry, compositionIndex) => {
            this.validateObjectType(entry, compositionIndex);
            encodedStrings.push(this.encodeComposition(entry, compositionIndex));
            (indicesByObjectType[entry.objectType] ??= []).push(compositionIndex);
        });

        await this.writeStringMapFile(encodedStrings);
        await this.writeIndexMapFile(indicesByObjectType);
        return {encodedStrings, indicesByObjectType};
    }

    // An entry belongs to exactly one object type, which must render itself through the indexed codec.
    private validateObjectType(entry: PreEncodingSourceEntry, compositionIndex: number): void
    {
        if (!entry.objectType || !ObjectTypeConfigMap.hasType(entry.objectType))
            throw new Error(`Composition pre-encoding failed :: Unknown objectType "${entry.objectType}" (compositionIndex = ${compositionIndex})`);

        const config = ObjectTypeConfigMap.getConfigByIndex(ObjectTypeConfigMap.getIndexByType(entry.objectType));
        const codecType = config.components.spawnedByAny?.instancedMeshComposer?.codecType;
        if (codecType != InstancedMeshCompositionCodecTypeEnumMap.Indexed)
            throw new Error(`Composition pre-encoding failed :: objectType "${entry.objectType}" does not use the indexed codec (compositionIndex = ${compositionIndex})`);
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
            // ...and mouldings only for wood.
            if (part.materialId == INSTANCED_WOOD_MATERIAL_ID)
            {
                if (part.mouldingColor == undefined || part.mouldingThickness == undefined
                    || part.mouldingIsConvex == undefined)
                    throw new Error(`Composition pre-encoding failed :: Material "${part.materialId}" needs mouldingColor, mouldingThickness and mouldingIsConvex (${where})`);
                if (!(part.mouldingThickness > 0))
                    throw new Error(`Composition pre-encoding failed :: mouldingThickness must be positive (${where})`);
                composedPart.mouldingColor = resolveIndeterminateColor(part.mouldingColor);
                composedPart.mouldingThickness = part.mouldingThickness;
                composedPart.mouldingIsConvex = part.mouldingIsConvex;
            }
            return composedPart;
        });
    }

    private async writeStringMapFile(encodedStrings: string[]): Promise<void>
    {
        // JSON.stringify, since the alphabet includes quotes and backslashes.
        const entries = encodedStrings.map(str => JSON.stringify(str)).join(",");

        const text = `// THIS FILE IS AUTO-GENERATED BY PreEncodedCompositionBuilder. DO NOT EDIT MANUALLY.
const PreEncodedCompositionStringMap: string[] = [${entries}];

export default PreEncodedCompositionStringMap;
`;
        await FileUtil.write(STRING_MAP_FILE_NAME, text, MAPS_ROOT_PATH);
    }

    private async writeIndexMapFile(indicesByObjectType: {[objectType: string]: number[]}): Promise<void>
    {
        const text = `// THIS FILE IS AUTO-GENERATED BY PreEncodedCompositionBuilder. DO NOT EDIT MANUALLY.
// Positions in PreEncodedCompositionStringMap that belong to each object type, in source order.
const PreEncodedCompositionIndexMap: {[objectType: string]: number[]} = ${JSON.stringify(indicesByObjectType)};

export default PreEncodedCompositionIndexMap;
`;
        await FileUtil.write(INDEX_MAP_FILE_NAME, text, MAPS_ROOT_PATH);
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
