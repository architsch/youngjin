import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";
import ParticleLayerConfig from "../../../../../src/client/graphics/particle/types/particleLayerConfig";
import ParticleEffectSource from "../types/particleEffectSource";

// Code plays an effect by its name, so a name is an identifier.
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

// Changes to the source's list of effects. Effects keep the file's order, since the name keys an object.
const EffectSourceUtil =
{
    parse: (text: string): ParticleEffectSource =>
    {
        const parsed = JSON.parse(text);
        if (parsed == null || typeof parsed != "object" || parsed.effects == null || typeof parsed.effects != "object"
            || Array.isArray(parsed.effects))
            throw new Error("It has no \"effects\" object.");
        return parsed;
    },
    // Why a name can't be taken, or undefined if it can.
    getNameProblem: (effects: ParticleEffectSource["effects"], name: string, currentName?: string): string | undefined =>
    {
        if (!NAME_PATTERN.test(name))
            return "A name starts with a letter and holds only letters, digits and underscores.";
        if (name != currentName && Object.prototype.hasOwnProperty.call(effects, name))
            return `"${name}" is taken.`;
        return undefined;
    },
    getFreeName: (effects: ParticleEffectSource["effects"], base: string): string =>
    {
        let name = base;
        for (let i = 2; Object.prototype.hasOwnProperty.call(effects, name); ++i)
            name = `${base}${i}`;
        return name;
    },
    // The new effect goes right after `after`, or last.
    withEffect: (effects: ParticleEffectSource["effects"], name: string, config: ParticleEffectConfig,
        after?: string): ParticleEffectSource["effects"] =>
    {
        const result: ParticleEffectSource["effects"] = {};
        for (const [key, value] of Object.entries(effects))
        {
            result[key] = value;
            if (key == after)
                result[name] = config;
        }
        if (!(name in result))
            result[name] = config;
        return result;
    },
    renamed: (effects: ParticleEffectSource["effects"], from: string, to: string): ParticleEffectSource["effects"] =>
    {
        return Object.fromEntries(Object.entries(effects).map(([key, value]) => [key == from ? to : key, value]));
    },
    without: (effects: ParticleEffectSource["effects"], name: string): ParticleEffectSource["effects"] =>
    {
        return Object.fromEntries(Object.entries(effects).filter(([key]) => key != name));
    },
    createLayer: (): ParticleLayerConfig =>
    {
        // A radial launch needs a box to be born across: from a point, it has no "out" and goes forward.
        return {
            sprite: "softDot", burst: 16, spawnHalfSize: {x: 0.2, y: 0.2, z: 0.2}, launch: "radial", spread: 0.6,
            speed: [1, 2.5], lifetime: [0.4, 0.8], size: [0.3, 0.5], drag: 3,
            alphaCurve: [1, 0.8, 0],
        };
    },
    createEffect: (): ParticleEffectConfig =>
    {
        return {layers: [EffectSourceUtil.createLayer()]};
    },
    // A deep copy, so editing one never edits the other.
    copy: <T>(value: T): T =>
    {
        return JSON.parse(JSON.stringify(value));
    },
}

export default EffectSourceUtil;
