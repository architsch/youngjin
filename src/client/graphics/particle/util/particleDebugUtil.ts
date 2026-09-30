import Vec3 from "../../../../shared/math/types/vec3";
import Waveform from "../../../../shared/math/types/waveform";
import { WaveformShape } from "../../../../shared/math/types/waveformShape";
import WaveformUtil from "../../../../shared/math/util/waveformUtil";
import VoxelQueryUtil from "../../../../shared/voxel/util/voxelQueryUtil";
import App from "../../../app";
import { voxelQuadSelectionObservable } from "../../../system/clientObservables";
import ParticleSystem from "../particleSystem";
import ParticleEffectConfigMap from "../maps/particleEffectConfigMap";
import SpriteConfigMap from "../maps/spriteConfigMap";
import ParticleEmitterHandle from "../types/particleEmitterHandle";
import SpriteHandle from "../types/spriteHandle";

// Just in front of the selected face, so a sprite there never fights it for depth.
const FACE_CLEARANCE = 0.02;
const DEFAULT_PULSE_DUTY = 0.3;

const testEmitters: ParticleEmitterHandle[] = [];
const testSprites: SpriteHandle[] = [];

// Debug commands (see DebugStats) that show any effect or sprite on the selected block face, so emitters,
// sprites and the solid batch can be seen before an object type uses them:
// - "vfx <effect>": plays it once, or starts it if it streams;
// - "sprite <name> [constant|sine|pulse low high frequency [duty]]": a sprite whose rate follows the waveform;
// - "vfx clear": stops and removes what these commands started.
// Names match whatever their case, since DebugStats lower-cases what is typed.
const ParticleDebugUtil =
{
    // A message for the user, or undefined when the command isn't one of these.
    tryRunCommand: (command: string): string | undefined =>
    {
        const words = command.trim().split(/\s+/);
        if (words[0] !== "vfx" && words[0] !== "sprite")
            return undefined;
        if (words[0] === "vfx" && words[1] === "clear")
            return clear();

        const face = getSelectedFace();
        if (face == undefined)
            return "Select a block face first.";
        const position: Vec3 = {
            x: face.center.x + face.dir.x * FACE_CLEARANCE,
            y: face.center.y + face.dir.y * FACE_CLEARANCE,
            z: face.center.z + face.dir.z * FACE_CLEARANCE,
        };
        return (words[0] === "vfx") ? runEffect(words[1], position, face.dir) :
            runSprite(words.slice(1), position, face.dir, face.size);
    },
}

function runEffect(name: string | undefined, position: Vec3, dir: Vec3): string
{
    const effect = findName(ParticleEffectConfigMap.getEffects(), name);
    if (effect == undefined)
        return `Unknown effect. Effects: ${ParticleEffectConfigMap.getEffects().join(", ")}`;

    const streams = ParticleEffectConfigMap.getConfig(effect)!.layers.some(layer => (layer.rate ?? 0) > 0);
    if (!streams)
    {
        ParticleSystem.play(effect, position, {direction: dir});
        return `Played ${effect}.`;
    }
    const emitter = ParticleSystem.createEmitter(effect);
    if (emitter == undefined)
        return "The particle system isn't ready.";
    emitter.setPose(position, dir);
    const voxels = App.getCurrentRoom()?.voxelGrid.voxels;
    if (voxels != undefined)
        emitter.setStopDistance(VoxelQueryUtil.getDistanceToOccupiedBlock(voxels, position, dir, 32));
    testEmitters.push(emitter);
    return `Started ${effect}.`;
}

function runSprite(args: string[], position: Vec3, dir: Vec3, size: number): string
{
    const sprite = findName(SpriteConfigMap.getSprites(), args[0]);
    if (sprite == undefined)
        return `Unknown sprite. Sprites: ${SpriteConfigMap.getSprites().join(", ")}`;
    const rate = parseWaveform(args.slice(1));
    if (rate == undefined)
        return "Waveform: constant|sine|pulse low high frequency [duty]";

    const handle = ParticleSystem.createSprite(sprite);
    if (handle == undefined)
        return "No sprite slot is free.";
    handle.setPose(position, dir, 0, size, size);
    handle.setRate(rate);
    testSprites.push(handle);
    return `Placed ${sprite}.`;
}

function clear(): string
{
    for (const emitter of testEmitters)
        emitter.stop();
    for (const sprite of testSprites)
        sprite.release();
    testEmitters.length = 0;
    testSprites.length = 0;
    return "Cleared the test effects.";
}

// A steady 1 when absent; undefined when malformed.
function parseWaveform(args: string[]): Waveform | undefined
{
    if (args.length == 0)
        return WaveformUtil.constant(1);
    const shape = args[0] as WaveformShape;
    if (shape !== "constant" && shape !== "sine" && shape !== "pulse")
        return undefined;
    const [low, high, frequency, duty] = args.slice(1).map(Number);
    if (shape === "constant")
        return WaveformUtil.constant(Number.isFinite(low) ? low : 1);
    if (![low, high, frequency].every(Number.isFinite))
        return undefined;
    return {shape, low, high, frequency, phase: 0, duty: Number.isFinite(duty) ? duty : DEFAULT_PULSE_DUTY};
}

// The selected face's middle, the way it faces, and the largest square that fits on it.
function getSelectedFace(): {center: Vec3, dir: Vec3, size: number} | undefined
{
    const selection = voxelQuadSelectionObservable.peek();
    if (selection == null)
        return undefined;
    const voxel = selection.voxel;
    const d = VoxelQueryUtil.getVoxelQuadTransformDimensions(voxel, selection.quadIndex);
    return {
        center: {x: voxel.col + 0.5 + d.offsetX, y: d.offsetY, z: voxel.row + 0.5 + d.offsetZ},
        dir: {x: d.dirX, y: d.dirY, z: d.dirZ},
        size: Math.min(d.scaleX, d.scaleY),
    };
}

function findName(names: string[], typed: string | undefined): string | undefined
{
    return (typed == undefined) ? undefined : names.find(name => name.toLowerCase() === typed.toLowerCase());
}

export default ParticleDebugUtil;
