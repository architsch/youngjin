import SpriteConfig from "../types/spriteConfig";

// Every persistent animated sprite, by name. Each is one row of the parameter texture, baked once at load.
const configs: {[sprite: string]: SpriteConfig} =
{
    // A fan's blades: a cut-out surface, lit like the housing it sits in, turning once per unit of rate.
    fanBlades: {sprite: "fanBlades", renderState: "solid", turnsPerUnit: 1, colorHex: "#c9ced4"},
    // A candle-sized flame flickering through its frames, brighter and larger as its rate peaks.
    flame: {sprite: "flame", renderState: "blended", additiveness: 1, framesPerUnit: 1,
        levelAlpha: 0.3, levelSize: 0.15, colorHex: "#ffc766"},
    // A pulsing glow, e.g. a machine's indicator, that follows its rate's level.
    glow: {sprite: "softDot", renderState: "blended", additiveness: 1, levelAlpha: 1, levelSize: 0.3,
        colorHex: "#9fe0ff"},
}

const SpriteConfigMap =
{
    getConfig: (sprite: string): SpriteConfig | undefined =>
    {
        return configs[sprite];
    },
    getSprites: (): string[] =>
    {
        return Object.keys(configs);
    },
}

export default SpriteConfigMap;
