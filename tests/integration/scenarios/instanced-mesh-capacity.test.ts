/**
 * Instanced mesh capacities (InstancedMeshCapacityMap). Composed meshes are created at the size SSG
 * generated, so a stale table or a variant the computation missed leaves parts undrawn with no error.
 * Covers: the generated table matching the current code, and any decodable appearance of every type,
 * in a room full of each, fitting the table.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";

import InstancedMeshCapacityBuilder from "../../../src/server/ssg/builder/instancedMeshCapacityBuilder";
import InstancedMeshCapacityMap from "../../../src/shared/graphics/mesh/composition/maps/instancedMeshCapacityMap";
import PreEncodedCompositionStringMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionStringMap";
import PreEncodedCompositionIndexMap from "../../../src/shared/graphics/mesh/composition/maps/preEncodedCompositionIndexMap";
import InstancedMeshIdMap from "../../../src/shared/graphics/mesh/maps/instancedMeshIdMap";
import { InstancedMeshCompositionCodecMap } from "../../../src/shared/graphics/mesh/composition/maps/instancedMeshCompositionCodecMap";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import InstancedMeshCompositionPart from "../../../src/shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import CompositionMetadataUtil from "../../../src/shared/graphics/mesh/composition/util/compositionMetadataUtil";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";

const COMPOSER_CONFIGS = ObjectTypeConfigMap.getAllConfigs()
    .filter(config => config.components.spawnedByAny?.instancedMeshComposer != undefined);

// An arbitrary stored composition for the type, decoded as its composer would decode it. Indexed types
// draw from their own entries, the only indices their (uneditable) metadata holds.
function arbitraryParts(objectType: string): fc.Arbitrary<InstancedMeshCompositionPart[]>
{
    const config = COMPOSER_CONFIGS.find(c => c.objectType == objectType)!;
    const composer = config.components.spawnedByAny!.instancedMeshComposer!;
    const codec = InstancedMeshCompositionCodecMap[composer.codecType];
    const prefix = CompositionMetadataUtil.getCodecPrefix(composer.codecType, composer.codecVersion);

    const body = composer.codecType == InstancedMeshCompositionCodecTypeEnumMap.Indexed
        ? fc.constantFrom(...PreEncodedCompositionIndexMap[objectType])
            .map(compositionIndex => codec.encode({compositionIndex}, []))
        : fc.string({maxLength: 32});
    return body.map(str => {
        const parts: InstancedMeshCompositionPart[] = [];
        codec.decode(prefix + str, {}, parts);
        return parts;
    });
}

describe("instanced mesh capacity", () => {
    it("the generated table matches the current compositions and room caps (re-run SSG if not)", () => {
        const expected = InstancedMeshCapacityBuilder.computeCapacities({
            encodedStrings: PreEncodedCompositionStringMap,
            indicesByObjectType: PreEncodedCompositionIndexMap,
        });
        expect(InstancedMeshCapacityMap).toEqual(expected);
    });

    it("every composing type has a room cap and sizes at least one mesh", () => {
        expect(COMPOSER_CONFIGS.length).toBeGreaterThan(0);
        for (const config of COMPOSER_CONFIGS)
            expect(config.maxCountPerRoom, config.objectType).toBeGreaterThan(0);
        expect(Object.keys(InstancedMeshCapacityMap).length).toBeGreaterThan(0);
    });

    it("a room full of every type, each in any decodable appearance, fits every mesh", () => {
        const partsByType = Object.fromEntries(
            COMPOSER_CONFIGS.map(config => [config.objectType, arbitraryParts(config.objectType)]));
        fc.assert(fc.property(fc.record(partsByType), (appearances) => {
            const needed: {[instancedMeshId: string]: number} = {};
            for (const config of COMPOSER_CONFIGS)
            {
                for (const part of appearances[config.objectType])
                {
                    const instancedMeshId = InstancedMeshIdMap.getInstancedMeshId(
                        part.geometryId, part.materialId);
                    needed[instancedMeshId] = (needed[instancedMeshId] ?? 0) + config.maxCountPerRoom!;
                }
            }
            for (const instancedMeshId in needed)
                expect(InstancedMeshCapacityMap[instancedMeshId] ?? 0, instancedMeshId).toBeGreaterThanOrEqual(needed[instancedMeshId]);
        }), {numRuns: 300});
    });
});
