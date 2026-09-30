import * as THREE from "three";
import { PARTICLE_CURVE_SAMPLES, PARTICLE_KIND_CODE, PARTICLE_ORIENTATION_CODE, PARTICLE_PARAM_ROW_TEXELS,
    PARTICLE_PARAM_TEXEL } from "../../shaders/particleShader";
import ParticleEffectConfigMap from "../maps/particleEffectConfigMap";
import SpriteConfigMap from "../maps/spriteConfigMap";
import ParticleLayerConfig from "../types/particleLayerConfig";
import SpriteConfig from "../types/spriteConfig";
import ParticleAtlasSprite from "../types/particleAtlasSprite";
import ParticleAtlasUtil from "./particleAtlasUtil";

// The parameter texture: one row per effect layer and per sprite definition (see PARTICLE_PARAM_TEXEL for
// a row's texels), read by the shader with texelFetch. The game bakes it once, at load, and never uploads it
// again; the particle effect editor bakes it anew after each edit.

const T = PARTICLE_PARAM_TEXEL;
const FLOATS_PER_ROW = PARTICLE_PARAM_ROW_TEXELS * 4;

let layerRowsByEffect: {[effect: string]: number[]} = {};
let rowBySprite: {[sprite: string]: number} = {};
let paramTexture: THREE.DataTexture | undefined;

const colorTemp = new THREE.Color();

const ParticleParamTextureUtil =
{
    // After the atlas is built (see ParticleAtlasUtil.build). Rows are numbered afresh, so particles still
    // alive from an earlier bake read the wrong rows if an effect or layer came or went before theirs.
    bake: (): THREE.DataTexture =>
    {
        layerRowsByEffect = {};
        rowBySprite = {};
        paramTexture?.dispose();

        const effects = ParticleEffectConfigMap.getEffects();
        const sprites = SpriteConfigMap.getSprites();
        const numRows = effects.reduce((sum, effect) =>
            sum + ParticleEffectConfigMap.getConfig(effect)!.layers.length, 0) + sprites.length;
        const data = new Float32Array(numRows * FLOATS_PER_ROW);

        let row = 0;
        for (const effect of effects)
        {
            layerRowsByEffect[effect] = [];
            for (const layer of ParticleEffectConfigMap.getConfig(effect)!.layers)
            {
                ParticleParamTextureUtil.writeLayerRow(data, row, layer, ParticleAtlasUtil.getSprite(layer.sprite));
                layerRowsByEffect[effect].push(row++);
            }
        }
        for (const sprite of sprites)
        {
            const config = SpriteConfigMap.getConfig(sprite)!;
            ParticleParamTextureUtil.writeSpriteRow(data, row, config, ParticleAtlasUtil.getSprite(config.sprite));
            rowBySprite[sprite] = row++;
        }

        paramTexture = new THREE.DataTexture(data, PARTICLE_PARAM_ROW_TEXELS, numRows,
            THREE.RGBAFormat, THREE.FloatType);
        paramTexture.magFilter = THREE.NearestFilter;
        paramTexture.minFilter = THREE.NearestFilter;
        paramTexture.generateMipmaps = false;
        paramTexture.needsUpdate = true;
        return paramTexture;
    },
    getLayerRows: (effect: string): number[] | undefined =>
    {
        return layerRowsByEffect[effect];
    },
    getSpriteRow: (sprite: string): number | undefined =>
    {
        return rowBySprite[sprite];
    },
    writeLayerRow: (data: Float32Array, row: number, layer: ParticleLayerConfig, sprite: ParticleAtlasSprite) =>
    {
        const solid = layer.renderState === "solid";
        writeTexel(data, row, T.atlasRect, sprite.u, sprite.v, sprite.width, sprite.height);
        writeTexel(data, row, T.animation, sprite.frames, layer.frameRate ?? 0, PARTICLE_KIND_CODE.particle,
            PARTICLE_ORIENTATION_CODE[layer.orientation ?? "camera"]);
        writeTexel(data, row, T.motion, layer.gravity ?? 0, layer.drag ?? 0, layer.turbulence ?? 0,
            layer.stretch ?? 0);
        writeTexel(data, row, T.look, solid ? 0 : (layer.additiveness ?? 0), (!solid && layer.lit) ? 1 : 0,
            layer.spin?.[0] ?? 0, layer.spin?.[1] ?? 0);
        writeTexel(data, row, T.sprite, 0, 0, 0, 0);
        writeTexel(data, row, T.spriteColor, 1, 1, 1, 0);
        writeCurves(data, row, layer.colorCurve ?? ["#ffffff"], layer.alphaCurve ?? [1], layer.sizeCurve ?? [1]);
    },
    writeSpriteRow: (data: Float32Array, row: number, config: SpriteConfig, sprite: ParticleAtlasSprite) =>
    {
        const solid = config.renderState === "solid";
        writeTexel(data, row, T.atlasRect, sprite.u, sprite.v, sprite.width, sprite.height);
        writeTexel(data, row, T.animation, sprite.frames, 0, PARTICLE_KIND_CODE.sprite, 0);
        writeTexel(data, row, T.motion, 0, 0, 0, 0);
        writeTexel(data, row, T.look, solid ? 0 : (config.additiveness ?? 0), (!solid && config.lit) ? 1 : 0, 0, 0);
        writeTexel(data, row, T.sprite, config.turnsPerUnit ?? 0, config.framesPerUnit ?? 0,
            config.levelAlpha ?? 0, config.levelSize ?? 0);
        colorTemp.set(config.colorHex ?? "#ffffff");
        writeTexel(data, row, T.spriteColor, colorTemp.r, colorTemp.g, colorTemp.b, 0);
        writeCurves(data, row, ["#ffffff"], [1], [1]);
    },
    // Evenly spaced values, from first to last, resampled to count samples by linear interpolation.
    resampleCurve: (values: number[], count: number): number[] =>
    {
        const samples: number[] = [];
        for (let i = 0; i < count; ++i)
        {
            if (values.length == 1)
            {
                samples.push(values[0]);
                continue;
            }
            const x = i / (count - 1) * (values.length - 1);
            const i0 = Math.min(Math.floor(x), values.length - 2);
            samples.push(values[i0] + (values[i0 + 1] - values[i0]) * (x - i0));
        }
        return samples;
    },
}

// Colors are linearized here (THREE.Color reads hex as sRGB); the shader blends them as they are.
function writeCurves(data: Float32Array, row: number, colorCurve: string[], alphaCurve: number[],
    sizeCurve: number[])
{
    const colors = colorCurve.map(hex => colorTemp.set(hex).clone());
    const reds = ParticleParamTextureUtil.resampleCurve(colors.map(c => c.r), PARTICLE_CURVE_SAMPLES);
    const greens = ParticleParamTextureUtil.resampleCurve(colors.map(c => c.g), PARTICLE_CURVE_SAMPLES);
    const blues = ParticleParamTextureUtil.resampleCurve(colors.map(c => c.b), PARTICLE_CURVE_SAMPLES);
    const alphas = ParticleParamTextureUtil.resampleCurve(alphaCurve, PARTICLE_CURVE_SAMPLES);
    const sizes = ParticleParamTextureUtil.resampleCurve(sizeCurve, PARTICLE_CURVE_SAMPLES);
    for (let i = 0; i < PARTICLE_CURVE_SAMPLES; ++i)
    {
        writeTexel(data, row, T.colorCurve + i, reds[i], greens[i], blues[i], alphas[i]);
        data[(row * PARTICLE_PARAM_ROW_TEXELS + T.sizeCurve + Math.floor(i / 4)) * 4 + (i % 4)] = sizes[i];
    }
}

function writeTexel(data: Float32Array, row: number, texel: number, x: number, y: number, z: number, w: number)
{
    const o = (row * PARTICLE_PARAM_ROW_TEXELS + texel) * 4;
    data[o] = x;
    data[o + 1] = y;
    data[o + 2] = z;
    data[o + 3] = w;
}

export default ParticleParamTextureUtil;
