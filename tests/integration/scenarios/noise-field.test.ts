/**
 * Scenario tests: the baked value-noise field
 *
 * The room's air, its sky, the land below the horizon and the texture-less finishes are all drawn
 * from one value-noise field, which is baked into a 3D texture once at load and read back by the
 * shaders rather than evaluated by them (see ValueNoiseTextureUtil). That trade is only sound while
 * the baked field still behaves like the field it replaced, and nothing about a shader reading a
 * wrong texture looks like an error — it looks like weather.
 *
 * Covers:
 * - Distribution: every channel is a field rather than a constant, centred where value noise sits
 * - Seamlessness: the field is continuous across the wrap, so tiling it shows no crease
 * - Decorrelation: the channels read together as a warp vector do not agree with each other
 * - Determinism: the same field every time, so a room looks the same on every load and to everyone
 * - Periodicity: the stacked octaves come back onto themselves all at once, at the distance the
 *   drifting clouds and smoke are wrapped at
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import ValueNoiseTextureUtil, { VALUE_NOISE_PERIOD }
    from "../../../src/client/graphics/util/valueNoiseTextureUtil";
import { VALUE_NOISE_FBM_PERIOD, VALUE_NOISE_SECOND_OCTAVE, VALUE_NOISE_THIRD_OCTAVE }
    from "../../../src/client/graphics/shaders/valueNoiseGLSL";

// The util hands the texture over by binding it onto a material being compiled, which is the only
// thing it is ever asked to do — so the tests ask for it the same way rather than through a door
// opened only for them.
function getBakedTexture(): THREE.Data3DTexture
{
    const shader = { uniforms: {} } as unknown as THREE.WebGLProgramParametersWithUniforms;
    ValueNoiseTextureUtil.bindUniform(shader);
    return (shader.uniforms as any).valueNoiseTexture.value as THREE.Data3DTexture;
}

function readChannel(texture: THREE.Data3DTexture, size: number,
    x: number, y: number, z: number, channel: number): number
{
    const data = texture.image.data as Uint8Array;
    return data[(((z * size) + y) * size + x) * 4 + channel] / 255;
}

describe("baked value-noise field", () =>
{
    const texture = getBakedTexture();
    const size = texture.image.width;
    const data = texture.image.data as Uint8Array;
    const texelCount = data.length / 4;

    it("is cubic, and covers whole lattice cells so that it can repeat", () =>
    {
        expect(texture.image.height).toBe(size);
        expect(texture.image.depth).toBe(size);
        // The wrap is only seamless where the texture spans a whole number of lattice cells, since a
        // partial cell would meet its own start mid-slope.
        expect(size % VALUE_NOISE_PERIOD).toBe(0);
        // Repeating in all three axes is what makes the block of texels a field without edges.
        expect(texture.wrapS).toBe(THREE.RepeatWrapping);
        expect(texture.wrapT).toBe(THREE.RepeatWrapping);
        expect(texture.wrapR).toBe(THREE.RepeatWrapping);
        // Read between texels rather than nearest, or the field arrives as visible cubes.
        expect(texture.minFilter).toBe(THREE.LinearFilter);
        expect(texture.magFilter).toBe(THREE.LinearFilter);
    });

    it("comes back onto itself, every octave at once, where drifting air is wrapped", () =>
    {
        // The clouds and the smoke keep how far they have drifted modulo this, so every octave of
        // the stacked field has to come round there exactly: one that did not would jump each time
        // the drift wrapped, which on a sky reads as a flicker with no cause anybody could find. The
        // base period and each finer octave must all fit a whole number of times.
        const basePeriods = VALUE_NOISE_FBM_PERIOD / VALUE_NOISE_PERIOD;
        expect(Number.isInteger(basePeriods)).toBe(true);
        for (const octave of [VALUE_NOISE_SECOND_OCTAVE, VALUE_NOISE_THIRD_OCTAVE])
            expect(basePeriods * octave).toBeCloseTo(Math.round(basePeriods * octave), 9);
    });

    it("gives every channel a field rather than a constant", () =>
    {
        for (let channel = 0; channel < 4; ++channel)
        {
            let sum = 0, sumOfSquares = 0;
            for (let i = channel; i < data.length; i += 4)
            {
                const value = data[i] / 255;
                sum += value;
                sumOfSquares += value * value;
            }
            const mean = sum / texelCount;
            const deviation = Math.sqrt(sumOfSquares / texelCount - mean * mean);

            // Value noise crowds around the middle of its range and reaches the ends only in
            // pockets, so the mean sits near a half and the spread is a fraction of that.
            expect(mean).toBeGreaterThan(0.45);
            expect(mean).toBeLessThan(0.55);
            expect(deviation).toBeGreaterThan(0.1);
        }
    });

    it("is continuous across its own wrap", () =>
    {
        // What a crease would look like: a step across the seam larger than the steps the field
        // takes anywhere else. Measured against an interior boundary rather than against a fixed
        // number, so the comparison holds whatever resolution the field is baked at.
        let seamStep = 0;
        let interiorStep = 0;
        const middle = size >> 1;
        for (let z = 0; z < size; ++z)
        {
            for (let y = 0; y < size; ++y)
            {
                for (let channel = 0; channel < 4; ++channel)
                {
                    seamStep += Math.abs(readChannel(texture, size, size - 1, y, z, channel) -
                        readChannel(texture, size, 0, y, z, channel));
                    interiorStep += Math.abs(readChannel(texture, size, middle, y, z, channel) -
                        readChannel(texture, size, middle + 1, y, z, channel));
                }
            }
        }
        expect(seamStep).toBeLessThanOrEqual(interiorStep);
    });

    it("keeps the channels independent of one another", () =>
    {
        // The first three are read together as one vector, so a field that agreed with itself would
        // drag every coordinate along a diagonal instead of in a direction.
        for (const [a, b] of [[0, 1], [0, 2], [1, 2], [0, 3], [1, 3], [2, 3]])
        {
            let sumA = 0, sumB = 0, sumAB = 0, sumAA = 0, sumBB = 0;
            for (let i = 0; i < texelCount; ++i)
            {
                const valueA = data[i * 4 + a] / 255;
                const valueB = data[i * 4 + b] / 255;
                sumA += valueA; sumB += valueB; sumAB += valueA * valueB;
                sumAA += valueA * valueA; sumBB += valueB * valueB;
            }
            const meanA = sumA / texelCount, meanB = sumB / texelCount;
            const correlation = (sumAB / texelCount - meanA * meanB) /
                Math.sqrt((sumAA / texelCount - meanA * meanA) *
                    (sumBB / texelCount - meanB * meanB));
            expect(Math.abs(correlation)).toBeLessThan(0.1);
        }
    });

    it("bakes once and hands the same field to every material", () =>
    {
        // Both that the work is not repeated per material, and that every material in the scene is
        // reading the same field — two materials on the same wall drawn from different noise would
        // not agree about where the air is thick.
        expect(getBakedTexture()).toBe(texture);
    });
});
