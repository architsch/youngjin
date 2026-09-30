import Vec3 from "../../../../shared/math/types/vec3";
import ParticleEffectConfig from "../types/particleEffectConfig";
import ParticleLayerConfig from "../types/particleLayerConfig";
import ParticleAtlasUtil from "./particleAtlasUtil";

// Every field a layer may set, in the order the particle effect editor writes them.
const LAYER_FIELDS: (keyof ParticleLayerConfig)[] = [
    "sprite", "renderState", "additiveness", "lit", "orientation", "stretch",
    "burst", "rate", "duration",
    "spawnHalfSize", "spawnOnSurface", "launch", "spread",
    "speed", "lifetime", "size", "spin", "gravity", "drag", "turbulence", "landing",
    "sizeCurve", "alphaCurve", "colorCurve", "frameRate",
];
const EFFECT_FIELDS: (keyof ParticleEffectConfig)[] = ["note", "layers"];
const RENDER_STATES = ["blended", "solid"];
const ORIENTATIONS = ["camera", "velocity"];
const LAUNCH_DIRECTIONS = ["forward", "radial"];
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// What is wrong with an effect's definition, since the compiler never sees it (see ParticleEffectConfigMap).
const ParticleEffectConfigUtil =
{
    getLayerFields: (): (keyof ParticleLayerConfig)[] =>
    {
        return [...LAYER_FIELDS];
    },
    getEffectFields: (): (keyof ParticleEffectConfig)[] =>
    {
        return [...EFFECT_FIELDS];
    },
    // Empty when the effect is sound.
    getProblems: (config: ParticleEffectConfig): string[] =>
    {
        if (config == null || typeof config != "object" || !Array.isArray(config.layers))
            return ["It has no list of layers."];
        const problems = getUnknownFields(config, EFFECT_FIELDS);
        if (config.note != undefined && typeof config.note != "string")
            problems.push("\"note\" is not text.");
        if (config.layers.length == 0)
            problems.push("It has no layers.");
        config.layers.forEach((layer, i) =>
        {
            for (const problem of getLayerProblems(layer))
                problems.push(`Layer ${i + 1}: ${problem}`);
        });
        return problems;
    },
}

function getLayerProblems(layer: ParticleLayerConfig): string[]
{
    if (layer == null || typeof layer != "object")
        return ["it is not an object."];
    const problems = getUnknownFields(layer, LAYER_FIELDS);
    if (!ParticleAtlasUtil.getSpriteIds().includes(layer.sprite))
        problems.push(`"sprite" is not an atlas sprite (${ParticleAtlasUtil.getSpriteIds().join(", ")}).`);
    checkChoice(problems, "renderState", layer.renderState, RENDER_STATES);
    checkChoice(problems, "orientation", layer.orientation, ORIENTATIONS);
    checkChoice(problems, "launch", layer.launch, LAUNCH_DIRECTIONS);
    for (const key of ["lit", "spawnOnSurface", "landing"] as const)
    {
        if (layer[key] != undefined && typeof layer[key] != "boolean")
            problems.push(`"${key}" is not true or false.`);
    }

    checkNumber(problems, "additiveness", layer.additiveness, 0, 1);
    checkNumber(problems, "stretch", layer.stretch, 0);
    checkNumber(problems, "burst", layer.burst, 0);
    if (Number.isFinite(layer.burst) && !Number.isInteger(layer.burst))
        problems.push("\"burst\" is not a whole number.");
    checkNumber(problems, "rate", layer.rate, 0);
    checkNumber(problems, "duration", layer.duration, 0);
    if (!((layer.burst ?? 0) > 0) && !((layer.rate ?? 0) > 0))
        problems.push("it never emits: neither \"burst\" nor \"rate\" is above zero.");
    checkNumber(problems, "spread", layer.spread, 0, Math.PI);
    checkNumber(problems, "gravity", layer.gravity);
    checkNumber(problems, "drag", layer.drag, 0);
    checkNumber(problems, "turbulence", layer.turbulence, 0);
    checkNumber(problems, "frameRate", layer.frameRate, 0);
    if (layer.spawnHalfSize != undefined && !isHalfSize(layer.spawnHalfSize))
        problems.push("\"spawnHalfSize\" is not an {x, y, z} of numbers at or above zero.");

    checkRange(problems, "speed", layer.speed, true, 0);
    checkRange(problems, "lifetime", layer.lifetime, true, 0, true);
    checkRange(problems, "size", layer.size, true, 0);
    checkRange(problems, "spin", layer.spin, false);

    checkCurve(problems, "sizeCurve", layer.sizeCurve, (value) => typeof value == "number" && value >= 0,
        "numbers at or above zero");
    checkCurve(problems, "alphaCurve", layer.alphaCurve,
        (value) => typeof value == "number" && value >= 0 && value <= 1, "numbers from 0 to 1");
    checkCurve(problems, "colorCurve", layer.colorCurve,
        (value) => typeof value == "string" && COLOR_PATTERN.test(value), "colors written \"#rrggbb\"");
    return problems;
}

function getUnknownFields(record: object, known: string[]): string[]
{
    return Object.keys(record).filter(key => !known.includes(key)).map(key => `unknown field "${key}".`);
}

function checkChoice(problems: string[], key: string, value: unknown, choices: string[])
{
    if (value != undefined && !choices.includes(value as string))
        problems.push(`"${key}" is not one of ${choices.join(", ")}.`);
}

function checkNumber(problems: string[], key: string, value: unknown, min = -Infinity, max = Infinity)
{
    if (value == undefined)
        return;
    if (typeof value != "number" || !Number.isFinite(value))
        problems.push(`"${key}" is not a number.`);
    else if (value < min || value > max)
        problems.push(`"${key}" is outside ${formatBounds(min, max)}.`);
}

function checkRange(problems: string[], key: string, value: unknown, required: boolean, min = -Infinity,
    aboveMin = false)
{
    if (value == undefined)
    {
        if (required)
            problems.push(`"${key}" is missing.`);
        return;
    }
    if (!Array.isArray(value) || value.length != 2 || !value.every(v => typeof v == "number" && Number.isFinite(v)))
        problems.push(`"${key}" is not a [min, max] pair of numbers.`);
    else if (value[0] > value[1])
        problems.push(`"${key}" runs backwards (its min is above its max).`);
    else if (value[0] < min || (aboveMin && value[0] == min))
        problems.push(`"${key}" must start ${aboveMin ? "above" : "at or above"} ${min}.`);
}

function checkCurve(problems: string[], key: string, value: unknown, isValid: (sample: unknown) => boolean,
    description: string)
{
    if (value == undefined)
        return;
    if (!Array.isArray(value) || value.length == 0 || !value.every(isValid))
        problems.push(`"${key}" is not a non-empty list of ${description}.`);
}

function isHalfSize(value: Vec3): boolean
{
    return value != null && typeof value == "object" && Object.keys(value).length == 3 &&
        [value.x, value.y, value.z].every(v => typeof v == "number" && Number.isFinite(v) && v >= 0);
}

function formatBounds(min: number, max: number): string
{
    if (max == Infinity)
        return `${min} and up`;
    if (min == -Infinity)
        return `up to ${max}`;
    return `${min}–${Number.isInteger(max) ? max : max.toFixed(3)}`;
}

export default ParticleEffectConfigUtil;
