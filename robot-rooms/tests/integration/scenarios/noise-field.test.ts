/**
 * Scenario tests: the baked value-noise texture (see ValueNoiseTextureUtil), read by shaders for air,
 * sky, land and texture-less finishes. Covers distribution, seamless wrapping, channel decorrelation,
 * determinism, and octave periodicity matching the cloud/smoke drift wrap.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import ValueNoiseTextureUtil, { VALUE_NOISE_PERIOD }
    from "../../../src/client/graphics/util/valueNoiseTextureUtil";
import { VALUE_NOISE_FBM_PERIOD, VALUE_NOISE_SECOND_OCTAVE, VALUE_NOISE_THIRD_OCTAVE }
    from "../../../src/client/graphics/shaders/valueNoiseGLSL";

// Fetched by binding onto a material, the util's only interface.
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
        // Seamless only if the texture spans whole lattice cells.
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
        // Clouds and smoke wrap their drift at this period, so every octave must fit it a whole number of
        // times (or the sky flickers on each wrap).
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

            // Value noise clusters mid-range: mean near a half, modest spread.
            expect(mean).toBeGreaterThan(0.45);
            expect(mean).toBeLessThan(0.55);
            expect(deviation).toBeGreaterThan(0.1);
        }
    });

    it("is continuous across its own wrap", () =>
    {
        // A crease is a seam step larger than interior steps (resolution-independent).
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
        // The first three channels form a warp vector, so they must not correlate.
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
        // Baked once and shared, so every material reads the same field.
        expect(getBakedTexture()).toBe(texture);
    });
});
