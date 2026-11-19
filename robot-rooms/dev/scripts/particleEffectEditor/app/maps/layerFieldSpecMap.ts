import ParticleLayerConfig from "../../../../../src/client/graphics/particle/types/particleLayerConfig";
import LayerFieldSpec from "../types/layerFieldSpec";

// How each layer field is edited, and what it does (after ParticleLayerConfig's own comments). Defaults are
// the ones the particle system applies to a field the layer leaves out.
const specs: {[field in keyof ParticleLayerConfig]-?: LayerFieldSpec} =
{
    sprite: {kind: "sprite", hint: "The atlas picture each particle shows."},
    renderState: {kind: "choice", options: ["blended", "solid"], defaultValue: "blended",
        hint: "Solid particles would hide what lies behind them, but the solid batch keeps none yet."},
    additiveness: {kind: "number", min: 0, max: 1, step: 0.01, defaultValue: 0,
        hint: "0 covers what lies behind it; 1 adds its light instead, and fades to nothing in fog."},
    lit: {kind: "toggle", defaultValue: false,
        hint: "Tinted by the lamp light where it floats. The preview has no lamps, so it shows as unlit."},
    orientation: {kind: "choice", options: ["camera", "velocity"], defaultValue: "camera",
        hint: "Faces the camera, or lies along its motion."},
    stretch: {kind: "number", min: 0, max: 2, step: 0.01, defaultValue: 0,
        hint: "Along its motion (\"velocity\" orientation): extra length per unit of speed."},
    frameRate: {kind: "number", min: 0, max: 60, step: 0.5, defaultValue: 0, unit: "fps",
        hint: "Flipbook frames per second; 0 plays the sprite's frames once over its life."},
    burst: {kind: "number", min: 0, max: 128, step: 1, defaultValue: 0,
        hint: "How many are born at once, when the effect is played or an emitter starts."},
    rate: {kind: "number", min: 0, max: 200, step: 0.5, defaultValue: 0, unit: "/s",
        hint: "How many are born per second while emitting."},
    duration: {kind: "number", min: 0, max: 10, step: 0.05, defaultValue: 0, unit: "s",
        hint: "How long a played effect keeps emitting at its rate. An emitter emits until stopped."},
    spawnHalfSize: {kind: "halfSize", max: 2, step: 0.01,
        hint: "Half the box they are born in: x and y across the effect's direction, z along it."},
    spawnOnSurface: {kind: "toggle", defaultValue: false,
        hint: "Born on the box's faces rather than inside it, e.g. around a block that would hide them."},
    launch: {kind: "choice", options: ["forward", "radial"], defaultValue: "forward",
        hint: "Along the effect's direction, or out from the box's middle."},
    spread: {kind: "number", min: 0, max: Math.PI, step: 0.01, defaultValue: 0, unit: "rad",
        hint: "How far each launch may stray from its direction."},
    speed: {kind: "range", min: 0, max: 20, step: 0.1, unit: "m/s",
        hint: "Launch speed, drawn between the two for each particle."},
    lifetime: {kind: "range", min: 0.05, max: 5, step: 0.01, unit: "s", hint: "From birth to death."},
    size: {kind: "range", min: 0, max: 4, step: 0.01, unit: "m",
        hint: "Width of its square. A soft sprite fills only part of it."},
    spin: {kind: "range", min: -20, max: 20, step: 0.1, defaultValue: [0, 0], unit: "rad/s",
        hint: "Turn rate, drawn between the two for each particle."},
    gravity: {kind: "number", min: -20, max: 20, step: 0.1, defaultValue: 0, unit: "m/s²",
        hint: "Pulls it down; negative lifts it."},
    drag: {kind: "number", min: 0, max: 20, step: 0.1, defaultValue: 0, unit: "/s",
        hint: "Slows it. A fast launch against high drag bursts out and stops short."},
    turbulence: {kind: "number", min: 0, max: 2, step: 0.01, defaultValue: 0, unit: "m",
        hint: "How far the shared noise pushes it about."},
    landing: {kind: "toggle", defaultValue: false, hint: "Held on the floor below where it was born."},
    sizeCurve: {kind: "curve", max: 2, defaultValue: [1], hint: "Size over its life, as a share of its size."},
    alphaCurve: {kind: "curve", max: 1, defaultValue: [1], hint: "Opacity over its life."},
    colorCurve: {kind: "colorCurve", defaultValue: ["#ffffff"], hint: "Color over its life, blended between stops."},
};

const sections: {title: string, fields: (keyof ParticleLayerConfig)[]}[] = [
    {title: "Look", fields: ["sprite", "renderState", "additiveness", "lit", "orientation", "stretch", "frameRate"]},
    {title: "Emission", fields: ["burst", "rate", "duration"]},
    {title: "Birth", fields: ["spawnHalfSize", "spawnOnSurface", "launch", "spread", "speed", "lifetime", "size",
        "spin"]},
    {title: "Motion", fields: ["gravity", "drag", "turbulence", "landing"]},
    {title: "Over its life", fields: ["sizeCurve", "alphaCurve", "colorCurve"]},
];

const LayerFieldSpecMap =
{
    getSpec: (field: keyof ParticleLayerConfig): LayerFieldSpec =>
    {
        return specs[field];
    },
    getSections: (): {title: string, fields: (keyof ParticleLayerConfig)[]}[] =>
    {
        return sections;
    },
}

export default LayerFieldSpecMap;
