/**
 * Sound (see docs/audio/audio.md), without a browser: the audio bundle builder (the click alone in silence, the game's own
 * sounds and then each WAV clip between their paddings where the map says, a loop's paddings holding its own other end, a
 * mono clip heard alike from both sides, other rates resampled with their length and pitch kept and a loop's seam kept
 * whole, nothing above the bundle's highest frequency folded back, every common kind of WAV file read, an MP3 file streamed
 * from where it is under a version of its own, what it can't use refused by name, encoding only when the bundle's samples
 * change and writing the map only when it does, no bundle without clips, the committed map being what it makes of the
 * committed sounds, and every recording the manifest lists credited beside it); the game's own sounds as made (the same every time, at their peaks and lengths, ending in silence or
 * looping seamlessly, each seeded by its name, and every one short enough, named once and, if a loop, going round whole);
 * how the click shows where a decoder put the clips; a sequence's shuffled order; how loud, how muffled and from which
 * side a positioned sound is heard; voices (a clip once, a loop, a gapless shuffled sequence at any rate, a missed turn,
 * stopping, volume, a positioned voice's nodes and levels, walls included, and streams through media elements: played,
 * looped, in sequence, skipped when they fail, let go of after a stop, waiting for an input when refused and while the page
 * is hidden); and the audio manager (nothing loaded without clips, the bundle downloaded once at an address that changes
 * with it, a map of streams alone needing no bundle, no sound before the user's first input, one-shots dropped while
 * nothing can be heard as loops wait, streams started without the bundle, quiet while hidden, positions heard from the
 * camera and muffled by the walls in between, positioned sounds stopped between rooms, unknown or mixed clips refused, the
 * decoder's shift and a voice's rate applied, a failed download). Real decoding and playing need a browser, and aren't run
 * here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import * as THREE from "three";

const graphics = vi.hoisted(() => ({camera: undefined as {matrixWorld: unknown} | undefined}));
vi.mock("../../../src/client/graphics/graphicsManager", () => ({default: {getCamera: () => graphics.camera}}));
// The walls between two points, as the voxel grid would count them (that count is checked in line-of-sight.test.ts).
const walls = vi.hoisted(() => ({count: 0, asked: [] as {from: {x: number, y: number, z: number},
    to: {x: number, y: number, z: number}}[]}));
vi.mock("../../../src/client/voxel/util/clientVoxelQueryUtil", () => ({default: {
    countDrawnVoxelBlocksBetween: (from: {x: number, y: number, z: number}, to: {x: number, y: number, z: number},
        max: number) => {
        walls.asked.push({from: {x: from.x, y: from.y, z: from.z}, to: {x: to.x, y: to.y, z: to.z}});
        return Math.min(walls.count, max);
    },
}}));

import AudioBundleBuilder, { AUDIO_BUNDLE_FILE_NAME, AUDIO_BUNDLE_SAMPLE_RATE, AUDIO_CLIP_PADDING_SECONDS,
    AUDIO_MARKER_TIME, AUDIO_MAX_BUNDLED_SECONDS } from "../../../src/server/ssg/builder/audioBundleBuilder";
import WavFileUtil from "../../../src/server/ssg/util/wavFileUtil";
import AudioResampleUtil from "../../../src/server/ssg/util/audioResampleUtil";
import ProceduralSoundUtil from "../../../src/server/ssg/util/proceduralSoundUtil";
import ProceduralSoundSpec from "../../../src/server/ssg/types/proceduralSoundSpec";
import { ProceduralSounds } from "../../../src/server/ssg/data/proceduralSounds";
import AudioBundleUtil, { AUDIO_MARKER_MIN_PEAK } from "../../../src/client/audio/util/audioBundleUtil";
import DecodedAudioBundle from "../../../src/client/audio/types/decodedAudioBundle";
import AudioClipShuffler from "../../../src/client/audio/types/audioClipShuffler";
import AudioVoice, { AUDIO_STOP_FADE_SECONDS, AUDIO_VOLUME_SMOOTHING_SECONDS }
    from "../../../src/client/audio/types/audioVoice";
import SpatialAudioVoice from "../../../src/client/audio/types/spatialAudioVoice";
import BundledClipPlayer from "../../../src/client/audio/types/bundledClipPlayer";
import SpatialAudioUtil, { SPATIAL_AUDIO_DEFAULT_RANGE, SPATIAL_AUDIO_MAX_OCCLUDING_WALLS, SPATIAL_AUDIO_MAX_PAN,
    SPATIAL_AUDIO_MIN_DISTANCE, SPATIAL_AUDIO_OPEN_CUTOFF_HZ, SPATIAL_AUDIO_WALL_CUTOFF_HZ, SPATIAL_AUDIO_WALL_GAIN }
    from "../../../src/client/audio/util/spatialAudioUtil";
import { SPATIAL_AUDIO_SMOOTHING_SECONDS } from "../../../src/client/audio/audioManager";
import AudioBundleInfo from "../../../src/client/audio/types/audioBundleInfo";
import { FakeAudioBuffer, FakeAudioBufferSourceNode, FakeAudioContext, FakeMediaElement, FakePage, stubWebAudio }
    from "../helpers/fakeWebAudio";
import { noise, sine, wrapPcm16, writeWav } from "../helpers/wavFixture";

const RATE = AUDIO_BUNDLE_SAMPLE_RATE;
const PADDING = Math.round(AUDIO_CLIP_PADDING_SECONDS * RATE);
const MARKER = Math.round(AUDIO_MARKER_TIME * RATE);
// What a sample may lose by going through 16-bit WAV files twice.
const SAMPLE_TOLERANCE = 3 / 32768;

// A map as the builder might write one; the manager's suites play from it.
const TEST_MAP: AudioBundleInfo = {
    path: "audio/bundle.mp3",
    version: "0123456789abcdef",
    markerTime: AUDIO_MARKER_TIME,
    clips: {
        "ui/blip": {start: 0.35, duration: 0.2},
        "amb/hum": {start: 0.65, duration: 1},
        "music/a": {start: 1.75, duration: 0.5},
        "music/b": {start: 2.35, duration: 0.5},
    },
    streams: {
        "music/calm": {path: "audio/music/calm.mp3", version: "fedcba9876543210"},
        "music/sea": {path: "audio/music/sea.mp3", version: "0011223344556677"},
    },
};
const NO_CLIPS_MAP: AudioBundleInfo = {path: "", version: "", markerTime: AUDIO_MARKER_TIME, clips: {}, streams: {}};

/** The bundle as a decoder hands it back: silent but for the click, shifted by shiftSeconds. */
function decodedBundle(map: AudioBundleInfo, shiftSeconds: number = 0, sampleRate: number = 48000): FakeAudioBuffer
{
    const end = Math.max(...Object.values(map.clips).map(clip => clip.start + clip.duration)) + 1;
    const samples = new Float32Array(Math.ceil(end * sampleRate));
    samples[Math.round((map.markerTime + shiftSeconds) * sampleRate)] = 0.8;
    return new FakeAudioBuffer([samples, samples.slice()], sampleRate);
}

function seededRandom(seed: number): () => number
{
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function settle(): Promise<void>
{
    for (let i = 0; i < 10; ++i)
        await new Promise(resolve => setTimeout(resolve, 0));
}

const ORIGIN = {x: 0, y: 0, z: 0};
const RIGHT = {x: 1, y: 0, z: 0};

describe("the audio bundle builder", () => {
    const roots: string[] = [];
    afterEach(() => {
        for (const root of roots.splice(0))
            fs.rmSync(root, {recursive: true, force: true});
    });

    type SourceClip = {name: string, file?: string, loop?: boolean, data?: Buffer};

    /** A directory of sources, and a manifest listing them (with notes of each, which the bundle never reads). */
    function makeRoot(clips: SourceClip[], author: string = "test"): string
    {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "audio-bundle-"));
        roots.push(root);
        writeSources(root, clips, author);
        return root;
    }

    function writeSources(root: string, clips: SourceClip[], author: string): void
    {
        for (const clip of clips)
        {
            if (clip.data == undefined)
                continue;
            const filePath = path.join(root, clip.file ?? `${clip.name}.wav`);
            fs.mkdirSync(path.dirname(filePath), {recursive: true});
            fs.writeFileSync(filePath, clip.data);
        }
        fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({clips: clips.map(clip =>
            ({name: clip.name, file: clip.file ?? `${clip.name}.wav`, author, title: clip.name,
                ...(clip.loop ? {loop: true} : {})}))}));
    }

    /** A builder writing into root, whose encoder writes the samples it is handed as a WAV file. */
    function makeBuilder(root: string, proceduralSounds: ProceduralSoundSpec[] = [])
    {
        const encode = vi.fn(async (pcm: Buffer, numChannels: number, sampleRate: number, filePath: string) => {
            fs.writeFileSync(filePath, wrapPcm16(pcm, numChannels, sampleRate));
        });
        const mapPath = path.join(root, "audioBundleMap.ts");
        const bundlePath = path.join(root, AUDIO_BUNDLE_FILE_NAME);
        return {
            builder: new AudioBundleBuilder({rootPath: root, mapFilePath: mapPath, encode, proceduralSounds}),
            encode, mapPath, bundlePath,
            readBundle: () => WavFileUtil.decode(fs.readFileSync(bundlePath)),
        };
    }

    /** cycles whole periods of a cosine (at its peak where it starts and ends), numSamples long. */
    function periodicCosine(numSamples: number, cycles: number, amplitude: number): Float32Array
    {
        return Float32Array.from({length: numSamples}, (_, i) => amplitude * Math.cos(2 * Math.PI * cycles * i / numSamples));
    }

    it("puts the click alone in silence, then each clip between its paddings, where the map says", async () => {
        const blip = noise(Math.round(0.1 * RATE), 0.5, 1);
        const humLeft = sine(0.2, RATE, 100, 0.5);
        const humRight = sine(0.2, RATE, 100, 0.5, Math.PI / 2);
        const tone = sine(0.15, RATE, 440, 0.4);
        const root = makeRoot([
            {name: "ui/blip", data: writeWav([blip], RATE)},
            {name: "amb/hum", loop: true, data: writeWav([humLeft, humRight], RATE, {bits: 32, float: true})},
            {name: "music/a", data: writeWav([tone], RATE, {bits: 24})},
        ]);
        const {builder, readBundle} = makeBuilder(root);
        const plan = await builder.plan();
        await builder.build();
        const bundle = readBundle();

        // One stereo clip makes the whole bundle stereo.
        expect(bundle.sampleRate).toBe(RATE);
        expect(bundle.channels.length).toBe(2);

        const sources = [[blip], [humLeft, humRight], [tone]];
        const loops = [false, true, false];
        let expectedStart = 3 * MARKER + PADDING;
        plan.clips.forEach(([name, clip], i) => {
            expect(name).toBe(["ui/blip", "amb/hum", "music/a"][i]);
            expect(clip.start).toBe(expectedStart / RATE);
            expect(clip.duration).toBe(sources[i][0].length / RATE);
            expectedStart += sources[i][0].length + 2 * PADDING;
        });
        expect(bundle.channels[0].length).toBe(expectedStart - PADDING);

        // The click, and nothing else up to where the first clip starts.
        const firstStart = Math.round(plan.clips[0][1].start * RATE);
        for (const channel of bundle.channels)
        {
            for (let i = 0; i < firstStart; ++i)
                expect(channel[i]).toBe((i == MARKER) ? 32767 / 32768 : 0);
        }

        plan.clips.forEach(([, clip], i) => {
            const start = Math.round(clip.start * RATE);
            const length = sources[i][0].length;
            bundle.channels.forEach((channel, c) => {
                // A mono clip is in both channels alike.
                const source = sources[i][Math.min(c, sources[i].length - 1)];
                for (let k = 0; k < length; ++k)
                    expect(Math.abs(channel[start + k] - source[k])).toBeLessThanOrEqual(SAMPLE_TOLERANCE);
                for (let k = 0; k < PADDING; ++k)
                {
                    // A one-shot's paddings are silent; a loop's hold its own other end.
                    const before = loops[i] ? source[length - PADDING + k] : 0;
                    const after = loops[i] ? source[k] : 0;
                    expect(Math.abs(channel[start - PADDING + k] - before)).toBeLessThanOrEqual(SAMPLE_TOLERANCE);
                    expect(Math.abs(channel[start + length + k] - after)).toBeLessThanOrEqual(SAMPLE_TOLERANCE);
                }
            });
        });
    });

    it("puts the game's own sounds first, as they are made, a looping one with its own ends about it", async () => {
        const knock: ProceduralSoundSpec = {name: "test/knock", duration: 0.1, peak: 0.6, layers: [
            {attack: 0.001, decay: 0.03, gain: 1, tone: {frequency: [300, 300]}}]};
        const whir: ProceduralSoundSpec = {name: "test/whir", duration: 0.5, peak: 0.5, loop: true, layers: [
            {attack: 0, decay: Infinity, gain: 1, noise: {filter: "lowpass", frequency: [800, 800]},
                wobble: {rate: 4, depth: 0.3}}]};
        const root = makeRoot([{name: "ui/blip", data: writeWav([sine(0.05, RATE, 880, 0.5)], RATE)}]);
        const {builder, readBundle} = makeBuilder(root, [knock, whir]);
        const plan = await builder.plan();
        await builder.build();

        expect(plan.clips.map(([name]) => name)).toEqual(["test/knock", "test/whir", "ui/blip"]);
        const channel = readBundle().channels[0];
        [knock, whir].forEach((spec, i) => {
            const made = ProceduralSoundUtil.render(spec, RATE);
            const start = Math.round(plan.clips[i][1].start * RATE);
            expect(plan.clips[i][1].duration).toBe(made.length / RATE);
            for (let k = 0; k < made.length; ++k)
                expect(Math.abs(channel[start + k] - made[k])).toBeLessThanOrEqual(SAMPLE_TOLERANCE);
            for (let k = 0; k < PADDING; ++k)
            {
                expect(Math.abs(channel[start - PADDING + k] - (spec.loop ? made[made.length - PADDING + k] : 0)))
                    .toBeLessThanOrEqual(SAMPLE_TOLERANCE);
                expect(Math.abs(channel[start + made.length + k] - (spec.loop ? made[k] : 0)))
                    .toBeLessThanOrEqual(SAMPLE_TOLERANCE);
            }
        });
    });

    it("resamples a clip of another rate, keeping its length and pitch, and a loop's seam whole", async () => {
        const otherRate = 48000;
        // A loop whose length comes to no whole number of samples at the bundle's rate.
        const loopLength = 12001;
        const loopCycles = 250;
        const root = makeRoot([
            {name: "tone", data: writeWav([sine(0.5, otherRate, 1000, 0.5)], otherRate, {bits: 32, float: true})},
            {name: "loop", loop: true, data: writeWav([periodicCosine(loopLength, loopCycles, 0.5)], otherRate,
                {bits: 32, float: true})},
        ]);
        const {builder, readBundle} = makeBuilder(root);
        const plan = await builder.plan();
        await builder.build();
        const samples = readBundle().channels[0];

        const [[, tone], [, loop]] = plan.clips;
        expect(Math.abs(tone.duration - 0.5)).toBeLessThanOrEqual(1 / RATE);
        const toneStart = Math.round(tone.start * RATE);
        const idealTone = sine(tone.duration, RATE, 1000, 0.5);
        // Away from its ends, where the silence it is padded with comes in.
        for (let i = 64; i < idealTone.length - 64; ++i)
            expect(Math.abs(samples[toneStart + i] - idealTone[i])).toBeLessThan(1e-3);

        // All of the loop, its ends included: its whole periods, stretched by less than a sample to a whole number of
        // samples, so that its last leads on to its first.
        const loopStart = Math.round(loop.start * RATE);
        const idealLoop = periodicCosine(Math.round(loop.duration * RATE), loopCycles, 0.5);
        expect(Math.abs(loop.duration - loopLength / otherRate)).toBeLessThan(1 / RATE);
        for (let i = 0; i < idealLoop.length; ++i)
            expect(Math.abs(samples[loopStart + i] - idealLoop[i])).toBeLessThan(1e-3);
    });

    it("keeps what lies above the bundle's highest frequency from folding back into what is heard", () => {
        const highRate = 96000;
        const resampled = AudioResampleUtil.resample(sine(0.1, highRate, 30000, 0.5), highRate, RATE);
        let sumOfSquares = 0;
        for (let i = 64; i < resampled.length - 64; ++i)
            sumOfSquares += resampled[i] * resampled[i];
        expect(Math.sqrt(sumOfSquares / (resampled.length - 128))).toBeLessThan(0.005);
    });

    it("reads every common kind of WAV file, skipping the chunks it doesn't need", () => {
        const samples = [sine(0.01, RATE, 440, 0.5), sine(0.01, RATE, 660, 0.25)];
        const kinds: [{bits: number, float?: boolean, extensible?: boolean}, number][] = [
            [{bits: 8}, 1 / 100], [{bits: 16}, 1e-4], [{bits: 24}, 1e-6], [{bits: 32}, 1e-8],
            [{bits: 32, float: true}, 1e-7], [{bits: 64, float: true}, 1e-12],
            [{bits: 16, extensible: true}, 1e-4], [{bits: 32, float: true, extensible: true}, 1e-7],
        ];
        for (const [options, tolerance] of kinds)
        {
            const audio = WavFileUtil.decode(writeWav(samples, RATE, options));
            expect(audio.sampleRate).toBe(RATE);
            expect(audio.channels.length).toBe(2);
            audio.channels.forEach((channel, c) => {
                expect(channel.length).toBe(samples[c].length);
                for (let i = 0; i < channel.length; ++i)
                    expect(Math.abs(channel[i] - samples[c][i])).toBeLessThanOrEqual(tolerance);
            });
        }

        // A chunk of odd size, and the byte that pads it, between the format and the samples.
        const plain = writeWav(samples, RATE);
        const extra = Buffer.from([...Buffer.from("LIST"), 3, 0, 0, 0, 1, 2, 3, 0]);
        const withExtra = Buffer.concat([plain.subarray(0, 36), extra, plain.subarray(36)]);
        withExtra.writeUInt32LE(withExtra.length - 8, 4);
        expect(WavFileUtil.decode(withExtra)).toEqual(WavFileUtil.decode(plain));
    });

    it("streams an MP3 file from where it is, under a version of its own, and leaves it out of the bundle", async () => {
        const mp3 = Buffer.from("not really an MP3, which the builder never reads into");
        const blip = {name: "ui/blip", data: writeWav([sine(0.05, RATE, 880, 0.5)], RATE)};
        const root = makeRoot([blip, {name: "music/calm", file: "music/calm.mp3", data: mp3}]);
        const {builder, encode, mapPath} = makeBuilder(root);
        const plan = await builder.plan();
        await builder.build();
        const version = crypto.createHash("sha256").update(mp3).digest("hex").slice(0, 16);
        expect(plan.streams).toEqual([["music/calm", {path: "audio/music/calm.mp3", version}]]);
        expect(plan.clips.map(([name]) => name)).toEqual(["ui/blip"]);
        expect(fs.readFileSync(mapPath, "utf8"))
            .toContain(`"music/calm": {path: "audio/music/calm.mp3", version: "${version}"},`);

        // A new file is a new version, and the bundle, which hasn't changed, isn't encoded again.
        const newer = Buffer.from("another stream");
        writeSources(root, [blip, {name: "music/calm", file: "music/calm.mp3", data: newer}], "test");
        await builder.build();
        expect(encode).toHaveBeenCalledTimes(1);
        expect(fs.readFileSync(mapPath, "utf8"))
            .toContain(crypto.createHash("sha256").update(newer).digest("hex").slice(0, 16));

        // Streams alone need no bundle.
        const streamsOnly = makeRoot([{name: "music/calm", file: "music/calm.mp3", data: mp3}]);
        const alone = makeBuilder(streamsOnly);
        fs.writeFileSync(alone.bundlePath, "left from before");
        await alone.builder.build();
        expect(fs.existsSync(alone.bundlePath)).toBe(false);
        expect(alone.encode).not.toHaveBeenCalled();
        expect(fs.readFileSync(alone.mapPath, "utf8")).toContain(`path: "",`);
    });

    it("refuses what it can't use, by its name", async () => {
        const one = sine(0.05, RATE, 440, 0.5);
        const good = writeWav([one], RATE);
        const twelveBits = writeWav([one], RATE);
        twelveBits.writeUInt16LE(12, 34);
        const tooLong = writeWav([new Float32Array(Math.ceil((AUDIO_MAX_BUNDLED_SECONDS + 1) * RATE))], RATE);
        const cases: [SourceClip[], string][] = [
            [[{name: "missing"}], `"missing.wav" can't be read`],
            [[{name: "text", data: Buffer.from("not a sound")}], `"text.wav" can't be read (it isn't a WAV file)`],
            [[{name: "odd", data: twelveBits}], `"odd.wav" can't be read (its samples are of a kind this can't read`],
            [[{name: "three", data: writeWav([one, one, one], RATE)}], `"three.wav" has 3 channels`],
            [[{name: "empty", data: writeWav([new Float32Array(0)], RATE)}], `"empty.wav" holds no sound`],
            [[{name: "long", data: tooLong}], `"long.wav" is ${(AUDIO_MAX_BUNDLED_SECONDS + 1).toFixed(1)} s long`],
            [[{name: "song", file: "song.ogg", data: good}], `"song.ogg" is neither a WAV file`],
            [[{name: "twice", data: good}, {name: "twice", file: "again.wav", data: good}], `"twice" names two clips`],
            [[{name: "", data: good}], "names a clip with no name"],
        ];
        for (const [clips, message] of cases)
        {
            const {builder, encode} = makeBuilder(makeRoot(clips));
            await expect(builder.build()).rejects.toThrow(message);
            expect(encode).not.toHaveBeenCalled();
        }

        const root = makeRoot([]);
        fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({clips: [{name: "nofile"}]}));
        await expect(makeBuilder(root).builder.build()).rejects.toThrow(`gives "nofile" no file`);
        fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({images: []}));
        await expect(makeBuilder(root).builder.build()).rejects.toThrow("has no list of clips");

        // One of the game's own sounds: too long, or under a name a clip of the manifest takes.
        const longSound: ProceduralSoundSpec = {name: "test/long", duration: AUDIO_MAX_BUNDLED_SECONDS + 1, peak: 0.5,
            layers: [{attack: 0, decay: Infinity, gain: 1, tone: {frequency: [100, 100]}}]};
        await expect(makeBuilder(makeRoot([]), [longSound]).builder.build()).rejects.toThrow(`"test/long" is`);
        const short: ProceduralSoundSpec = {...longSound, duration: 0.05};
        await expect(makeBuilder(makeRoot([{name: "test/long", data: good}]), [short]).builder.build())
            .rejects.toThrow(`"test/long" names two clips`);

        // An encoder that fails leaves the map as it was, for the next build to try again.
        const failing = makeRoot([{name: "a", data: good}]);
        const mapPath = path.join(failing, "audioBundleMap.ts");
        fs.writeFileSync(mapPath, "before");
        const broken = new AudioBundleBuilder({rootPath: failing, mapFilePath: mapPath, proceduralSounds: [],
            encode: async () => { throw new Error("LAME is not installed (brew install lame)"); }});
        await expect(broken.build()).rejects.toThrow("brew install lame");
        expect(fs.readFileSync(mapPath, "utf8")).toBe("before");
    });

    it("encodes, and writes the map, only when what the bundle is made of changes", async () => {
        const clip = {name: "a", data: writeWav([sine(0.1, RATE, 440, 0.5)], RATE)};
        const root = makeRoot([clip]);
        const {builder, encode, mapPath, bundlePath} = makeBuilder(root);
        await builder.build();
        const version = (await builder.plan()).version;
        const mapTime = fs.statSync(mapPath).mtimeMs;

        await builder.build();
        expect(encode).toHaveBeenCalledTimes(1);
        expect(fs.statSync(mapPath).mtimeMs).toBe(mapTime);

        // Only the notes about a clip change, which the bundle never reads.
        writeSources(root, [clip], "someone else");
        await builder.build();
        expect(encode).toHaveBeenCalledTimes(1);

        // Its sound changes.
        const louder = {name: "a", data: writeWav([sine(0.1, RATE, 440, 0.6)], RATE)};
        writeSources(root, [louder], "test");
        await builder.build();
        expect(encode).toHaveBeenCalledTimes(2);
        const louderVersion = (await builder.plan()).version;
        expect(louderVersion).not.toBe(version);
        expect(fs.readFileSync(mapPath, "utf8")).toContain(`version: "${louderVersion}"`);

        // It becomes a loop, whose paddings hold its own sound.
        writeSources(root, [{...louder, loop: true}], "test");
        await builder.build();
        expect(encode).toHaveBeenCalledTimes(3);
        expect((await builder.plan()).version).not.toBe(louderVersion);

        // Its bundle is gone.
        fs.rmSync(bundlePath);
        await builder.build();
        expect(encode).toHaveBeenCalledTimes(4);
        expect(fs.existsSync(bundlePath)).toBe(true);
    });

    it("makes no bundle while there are no clips, and maps none", async () => {
        const root = makeRoot([]);
        const {builder, encode, mapPath, bundlePath} = makeBuilder(root);
        fs.writeFileSync(bundlePath, "left from before");
        await builder.build();
        expect(fs.existsSync(bundlePath)).toBe(false);
        expect(encode).not.toHaveBeenCalled();
        const mapText = fs.readFileSync(mapPath, "utf8");
        expect(mapText).toContain(`path: "",`);
        expect(mapText).toContain(`version: "",`);
        expect(mapText).toContain("clips: {},");
        expect(mapText).toContain("streams: {},");
    });

    it("left the committed map as it makes it of the game's own sounds and the committed manifest", async () => {
        const plan = await new AudioBundleBuilder().plan();
        expect(fs.readFileSync(path.join(process.cwd(), "src/client/audio/maps/audioBundleMap.ts"), "utf8"))
            .toBe(plan.mapText);
        expect(fs.existsSync(path.join(process.cwd(), "public/app/assets/audio", AUDIO_BUNDLE_FILE_NAME)))
            .toBe(plan.pcm != undefined);
    });

    it("finds every recording the committed manifest lists credited in the README beside it", () => {
        const root = path.join(process.cwd(), "public/app/assets/audio");
        const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")) as {clips: {file: string}[]};
        expect(manifest.clips.length).toBeGreaterThan(0);
        for (const {file} of manifest.clips)
        {
            const readme = fs.readFileSync(path.join(root, path.dirname(file), "README.md"), "utf8");
            expect(readme).toContain(`\`${path.basename(file)}\``);
        }
    });
});

describe("the game's own sounds", () => {
    const knock: ProceduralSoundSpec = {name: "test/knock", duration: 0.2, peak: 0.7, layers: [
        {attack: 0.001, decay: 0.04, gain: 1, tone: {frequency: [400, 400], partials: [{ratio: 1, gain: 1},
            {ratio: 2.5, gain: 0.4, decay: 0.02}]}},
        {attack: 0.0005, decay: 0.005, gain: 0.5, noise: {filter: "bandpass", frequency: [2000, 2000], q: 1}},
    ]};
    const whir: ProceduralSoundSpec = {name: "test/whir", duration: 1, peak: 0.5, loop: true, layers: [
        {attack: 0, decay: Infinity, gain: 1, noise: {filter: "lowpass", frequency: [700, 700]}, wobble: {rate: 6, depth: 0.4}},
        {attack: 0, decay: Infinity, gain: 0.2, tone: {frequency: [120, 120]}},
    ]};

    it("are made the same every time, peaking where they say, as long as they say", () => {
        for (const spec of [knock, whir])
        {
            const made = ProceduralSoundUtil.render(spec, RATE);
            expect(ProceduralSoundUtil.render(spec, RATE)).toEqual(made);
            expect(made.length).toBe(Math.round(spec.duration * RATE));
            expect(Math.max(...made.map(Math.abs))).toBeCloseTo(spec.peak, 6);
        }
    });

    it("end in silence, or run their end on into their start when they loop", () => {
        const knocked = ProceduralSoundUtil.render(knock, RATE);
        expect(knocked[knocked.length - 1]).toBe(0);
        const whirring = ProceduralSoundUtil.render(whir, RATE);
        let largestStep = 0;
        for (let i = 1; i < whirring.length; ++i)
            largestStep = Math.max(largestStep, Math.abs(whirring[i] - whirring[i - 1]));
        expect(Math.abs(whirring[0] - whirring[whirring.length - 1])).toBeLessThanOrEqual(largestStep);
    });

    it("start a layer at its delay, glide a tone to its second frequency, and draw their noise from their names", () => {
        const delay = 0.05;
        const glide: ProceduralSoundSpec = {name: "test/glide", duration: 0.4, peak: 0.5, layers: [
            {delay, attack: 0.001, decay: Infinity, gain: 1, tone: {frequency: [200, 800], glide: 0.1}}]};
        const made = ProceduralSoundUtil.render(glide, RATE);
        for (let i = 0; i < Math.round(delay * RATE); ++i)
            expect(made[i]).toBe(0);
        // Past its glide, as many crossings as its second frequency makes.
        const from = Math.round(0.2 * RATE);
        const to = Math.round(0.35 * RATE);
        let crossings = 0;
        for (let i = from + 1; i < to; ++i)
            crossings += ((made[i - 1] < 0) != (made[i] < 0)) ? 1 : 0;
        expect(crossings / 2 / ((to - from) / RATE)).toBeCloseTo(800, -1);

        expect(ProceduralSoundUtil.render({...knock, name: "test/other"}, RATE))
            .not.toEqual(ProceduralSoundUtil.render(knock, RATE));
    });

    it("are each named once, short enough for the bundle, and, if a loop, go round a whole number of times in it", () => {
        const names = ProceduralSounds.map(spec => spec.name);
        expect(new Set(names).size).toBe(names.length);
        for (const spec of ProceduralSounds)
        {
            expect(spec.duration).toBeLessThanOrEqual(AUDIO_MAX_BUNDLED_SECONDS);
            expect(spec.peak).toBeGreaterThan(0);
            expect(spec.peak).toBeLessThanOrEqual(1);
            if (!spec.loop)
                continue;
            for (const layer of spec.layers)
            {
                expect([layer.attack, layer.decay, layer.delay ?? 0]).toEqual([0, Infinity, 0]);
                if (layer.wobble)
                    expect(Number.isInteger(Math.round(layer.wobble.rate * spec.duration * 1e6) / 1e6)).toBe(true);
                if (layer.tone)
                {
                    expect(layer.tone.frequency[0]).toBe(layer.tone.frequency[1]);
                    for (const partial of layer.tone.partials ?? [{ratio: 1}])
                    {
                        const cycles = layer.tone.frequency[0] * partial.ratio * spec.duration;
                        expect(Math.abs(cycles - Math.round(cycles))).toBeLessThan(1e-6);
                    }
                }
            }
        }
    });
});

describe("where a decoder put the clips", () => {
    const sampleRate = 48000;
    function withClick(shiftSeconds: number, peak: number): FakeAudioBuffer
    {
        const samples = new Float32Array(Math.round(4 * AUDIO_MARKER_TIME * sampleRate));
        samples[Math.round((AUDIO_MARKER_TIME + shiftSeconds) * sampleRate)] = peak;
        return new FakeAudioBuffer([samples], sampleRate);
    }

    it("is shown by the click, shifted either way by nearly as long as the bundle has before it", () => {
        for (const shift of [-0.9 * AUDIO_MARKER_TIME, -0.01, 0, 0.026, 0.9 * AUDIO_MARKER_TIME])
        {
            const found = AudioBundleUtil.findMarkerOffset(withClick(shift, 0.8) as unknown as AudioBuffer, AUDIO_MARKER_TIME);
            expect(Math.abs(found! - shift)).toBeLessThanOrEqual(1 / sampleRate);
        }
    });

    it("is unknown when the click is missing or too faint, and never taken from a clip past it", () => {
        const find = (buffer: FakeAudioBuffer) =>
            AudioBundleUtil.findMarkerOffset(buffer as unknown as AudioBuffer, AUDIO_MARKER_TIME);
        expect(find(withClick(0, 0))).toBeUndefined();
        expect(find(withClick(0, 0.9 * AUDIO_MARKER_MIN_PEAK))).toBeUndefined();
        const loudAfter = withClick(0.01, 0.6);
        loudAfter.channels[0].fill(1, Math.round(2 * AUDIO_MARKER_TIME * sampleRate) + 1);
        expect(Math.abs(find(loudAfter)! - 0.01)).toBeLessThanOrEqual(1 / sampleRate);
    });

    it("moves every clip by the shift found", () => {
        const bundle = new DecodedAudioBundle(decodedBundle(TEST_MAP) as unknown as AudioBuffer, TEST_MAP.clips, 0.02);
        for (const [name, clip] of Object.entries(TEST_MAP.clips))
            expect(bundle.getClip(name)).toEqual({start: clip.start + 0.02, duration: clip.duration});
        expect(bundle.getClip("constructor")).toBeUndefined();
        expect(bundle.getClip("none")).toBeUndefined();
    });
});

describe("a sequence's shuffled order", () => {
    it("plays every clip once a round, and never one twice in a row, even from one round to the next", () => {
        fc.assert(fc.property(fc.integer({min: 2, max: 8}), fc.integer({min: 0, max: 2 ** 31}), (numClips, seed) => {
            const clips = Array.from({length: numClips}, (_, i) => `clip${i}`);
            const shuffler = new AudioClipShuffler(clips, seededRandom(seed));
            let last: string | undefined;
            for (let round = 0; round < 20; ++round)
            {
                const played: string[] = [];
                for (let i = 0; i < numClips; ++i)
                {
                    const clip = shuffler.next();
                    expect(clip).not.toBe(last);
                    last = clip;
                    played.push(clip);
                }
                expect(played.sort()).toEqual([...clips].sort());
            }
        }));
    });

    it("repeats a lone clip, and plays one listed twice no more often than the rest", () => {
        const lone = new AudioClipShuffler(["a"]);
        expect([lone.next(), lone.next(), lone.next()]).toEqual(["a", "a", "a"]);
        const twice = new AudioClipShuffler(["a", "b", "a"], seededRandom(7));
        const played = Array.from({length: 6}, () => twice.next());
        expect(played.filter(clip => clip == "a").length).toBe(3);
    });
});

describe("how a positioned sound is heard", () => {
    const range = SPATIAL_AUDIO_DEFAULT_RANGE;

    it("is at its loudest near the camera, fades the farther it is, and is silent from its range on", () => {
        expect(SpatialAudioUtil.getDistanceGain(0, range)).toBe(1);
        expect(SpatialAudioUtil.getDistanceGain(SPATIAL_AUDIO_MIN_DISTANCE, range)).toBe(1);
        expect(SpatialAudioUtil.getDistanceGain(range, range)).toBe(0);
        expect(SpatialAudioUtil.getDistanceGain(2 * range, range)).toBe(0);
        expect(SpatialAudioUtil.getDistanceGain(SPATIAL_AUDIO_MIN_DISTANCE, 0)).toBe(0);
        fc.assert(fc.property(fc.integer({min: 1, max: 999}), fc.integer({min: 1, max: 999}), (a, b) => {
            fc.pre(a != b);
            const span = range - SPATIAL_AUDIO_MIN_DISTANCE;
            const near = SPATIAL_AUDIO_MIN_DISTANCE + span * Math.min(a, b) / 1000;
            const far = SPATIAL_AUDIO_MIN_DISTANCE + span * Math.max(a, b) / 1000;
            expect(SpatialAudioUtil.getDistanceGain(near, range)).toBeGreaterThan(SpatialAudioUtil.getDistanceGain(far, range));
        }));
        // It eases out: halfway to its range, a sound is already well below half as loud.
        expect(SpatialAudioUtil.getDistanceGain(0.5 * (SPATIAL_AUDIO_MIN_DISTANCE + range), range)).toBeLessThan(0.5);
        // A range shorter than the minimum distance is still faded out over, from halfway along it.
        const short = SPATIAL_AUDIO_MIN_DISTANCE / 2;
        expect(SpatialAudioUtil.getDistanceGain(short / 2, short)).toBe(1);
        expect(SpatialAudioUtil.getDistanceGain(0.75 * short, short)).toBeGreaterThan(0);
        expect(SpatialAudioUtil.getDistanceGain(0.75 * short, short)).toBeLessThan(1);
    });

    it("is heard from its side of the camera, short of one ear alone, and from the middle when at it", () => {
        const pan = (position: {x: number, y: number, z: number}) => SpatialAudioUtil.getPan(ORIGIN, RIGHT, position);
        expect(pan({x: 5, y: 0, z: 0})).toBeCloseTo(SPATIAL_AUDIO_MAX_PAN, 12);
        expect(pan({x: -5, y: 0, z: 0})).toBeCloseTo(-SPATIAL_AUDIO_MAX_PAN, 12);
        expect(pan({x: 0, y: 0, z: -5})).toBeCloseTo(0, 12);
        expect(pan({x: 0, y: 5, z: 0})).toBeCloseTo(0, 12);
        expect(pan(ORIGIN)).toBe(0);
        expect(pan({x: 5, y: 0, z: -5})).toBeCloseTo(SPATIAL_AUDIO_MAX_PAN * Math.SQRT1_2, 12);
        // Nearer than the minimum distance, it draws in toward the middle.
        expect(pan({x: SPATIAL_AUDIO_MIN_DISTANCE / 2, y: 0, z: 0})).toBeCloseTo(SPATIAL_AUDIO_MAX_PAN / 2, 12);
        fc.assert(fc.property(fc.integer({min: -100, max: 100}), fc.integer({min: -100, max: 100}),
            fc.integer({min: -100, max: 100}), (x, y, z) => {
                const position = {x: x / 10, y: y / 10, z: z / 10};
                expect(Math.abs(pan(position))).toBeLessThanOrEqual(SPATIAL_AUDIO_MAX_PAN);
                expect(pan({x: -position.x, y: position.y, z: position.z}) + pan(position)).toBeCloseTo(0, 12);
            }));
    });

    it("is muffled by each wall between it and the camera, quieter and duller, up to the most that count", () => {
        expect(SpatialAudioUtil.getOcclusionGain(0)).toBe(1);
        expect(SpatialAudioUtil.getOcclusionCutoff(0)).toBe(SPATIAL_AUDIO_OPEN_CUTOFF_HZ);
        for (let walls = 1; walls <= SPATIAL_AUDIO_MAX_OCCLUDING_WALLS; ++walls)
        {
            expect(SpatialAudioUtil.getOcclusionGain(walls)).toBeCloseTo(SPATIAL_AUDIO_WALL_GAIN ** walls, 12);
            expect(SpatialAudioUtil.getOcclusionCutoff(walls)).toBeCloseTo(SPATIAL_AUDIO_WALL_CUTOFF_HZ / 2 ** (walls - 1), 9);
        }
        const most = SPATIAL_AUDIO_MAX_OCCLUDING_WALLS;
        expect(SpatialAudioUtil.getOcclusionGain(most + 2)).toBe(SpatialAudioUtil.getOcclusionGain(most));
        expect(SpatialAudioUtil.getOcclusionCutoff(most + 2)).toBe(SpatialAudioUtil.getOcclusionCutoff(most));
    });
});

describe("a voice", () => {
    let page: FakePage;
    let context: FakeAudioContext;
    let bundle: DecodedAudioBundle;
    beforeEach(() => {
        page = stubWebAudio();
        context = new FakeAudioContext();
        bundle = new DecodedAudioBundle(decodedBundle(TEST_MAP) as unknown as AudioBuffer, TEST_MAP.clips, 0.01);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    const start = (voice: AudioVoice) =>
        voice.start(context as unknown as BaseAudioContext, context.destination as unknown as AudioNode,
            (output, onFinished, onReleased) => new BundledClipPlayer(context as unknown as BaseAudioContext, output,
                bundle, voice.clips, voice.looping, voice.rate, onFinished, onReleased));
    const nameOf = (source: FakeAudioBufferSourceNode) =>
        Object.keys(TEST_MAP.clips).find(name => bundle.getClip(name)!.start == source.started!.offset);

    // What starts streamed voices through a fresh stream util, whose listeners are on this suite's page.
    async function streamStarter(): Promise<(voice: AudioVoice) => void>
    {
        vi.resetModules();
        const {default: StreamedClipPlayer} = await import("../../../src/client/audio/types/streamedClipPlayer");
        return voice => voice.start(context as unknown as BaseAudioContext, context.destination as unknown as AudioNode,
            (output, onFinished, onReleased) => new StreamedClipPlayer(context as unknown as AudioContext, output,
                clip => `https://assets.test/${clip}.mp3`, voice.clips, voice.looping, voice.rate, onFinished, onReleased));
    }

    async function startStreamed(voice: AudioVoice): Promise<void>
    {
        (await streamStarter())(voice);
    }

    it("plays a clip once, from where it lies for as long as it lasts at its rate, then lets go of its nodes", () => {
        context.currentTime = 2;
        const voice = new AudioVoice(["ui/blip"], false, 0.5, 1.25);
        start(voice);
        const [source] = context.sources;
        const [output] = context.gains;
        const clip = bundle.getClip("ui/blip")!;
        expect(source.started).toEqual({when: 2, offset: clip.start, duration: clip.duration, at: 2});
        expect(source.playbackRate.value).toBe(1.25);
        expect(source.loop).toBe(false);
        expect(source.outputs).toEqual([output]);
        expect(output.outputs).toEqual([context.destination]);
        expect(output.gain.value).toBe(0.5);

        context.advance(0.9 * clip.duration / 1.25);
        expect(voice.isEnded()).toBe(false);
        context.advance(0.2 * clip.duration / 1.25);
        expect(voice.isEnded()).toBe(true);
        expect(source.outputs).toEqual([]);
        expect(output.outputs).toEqual([]);
    });

    it("loops a clip between its ends until stopped, then fades it out", () => {
        const voice = new AudioVoice(["amb/hum"], true, 1);
        start(voice);
        const [source] = context.sources;
        const clip = bundle.getClip("amb/hum")!;
        expect(source.loop).toBe(true);
        expect([source.loopStart, source.loopEnd]).toEqual([clip.start, clip.start + clip.duration]);
        expect(source.started).toMatchObject({when: 0, offset: clip.start, duration: undefined});

        context.advance(10);
        expect(voice.isEnded()).toBe(false);
        voice.stop();
        expect(voice.isEnded()).toBe(true);
        const gain = context.gains[0].gain;
        expect(gain.events.slice(-1)[0]).toEqual({type: "ramp", value: 0, time: 10 + AUDIO_STOP_FADE_SECONDS});
        expect(source.stopTime).toBe(10 + AUDIO_STOP_FADE_SECONDS);
        context.advance(AUDIO_STOP_FADE_SECONDS);
        expect(context.gains[0].outputs).toEqual([]);
    });

    it("plays several clips one after another with no gap at its rate, shuffled, never one twice in a row", () => {
        const rate = 1.25;
        const voice = new AudioVoice(["music/a", "music/b", "ui/blip"], true, 1, rate);
        start(voice);
        // One plays, and the next waits behind it.
        expect(context.sources.length).toBe(2);
        for (let i = 0; i < 40; ++i)
        {
            context.advance(0.1);
            expect(context.sources.filter(source => !source.ended).length).toBe(2);
        }
        const played = context.sources.map(nameOf);
        expect(played.every(name => name != undefined)).toBe(true);
        for (let i = 1; i < context.sources.length; ++i)
        {
            const previous = context.sources[i - 1].started!;
            expect(context.sources[i].started!.when).toBeCloseTo(previous.when + previous.duration! / rate, 12);
            expect(played[i]).not.toBe(played[i - 1]);
        }

        voice.stop();
        const now = context.currentTime;
        for (const source of context.sources.filter(source => !source.ended))
            expect(source.stopTime).toBe(now + AUDIO_STOP_FADE_SECONDS);
        context.advance(AUDIO_STOP_FADE_SECONDS);
        expect(context.sources.every(source => source.ended)).toBe(true);
        expect(context.gains[0].outputs).toEqual([]);
        expect(context.sources.length).toBe(played.length);
    });

    it("starts a turn it missed, while the page was too busy, as soon as it can", () => {
        const voice = new AudioVoice(["music/a", "music/b"], true, 1);
        start(voice);
        const [first] = context.sources;
        context.currentTime = 5;
        first.ended = true;
        first.onended!();
        expect(context.sources[2].started!.when).toBe(5);
        expect(voice.isEnded()).toBe(false);
    });

    it("starts at the volume it was last given, and eases to a new one", () => {
        const voice = new AudioVoice(["ui/blip"], false, 1);
        voice.setVolume(0.3);
        start(voice);
        const gain = context.gains[0].gain;
        expect(gain.value).toBe(0.3);
        context.currentTime = 0.05;
        voice.setVolume(0.8);
        expect(gain.events.slice(-1)[0]).toEqual(
            {type: "target", value: 0.8, time: 0.05, timeConstant: AUDIO_VOLUME_SMOOTHING_SECONDS});
        voice.stop();
        const numEvents = gain.events.length;
        voice.setVolume(1);
        expect(gain.events.length).toBe(numEvents);
    });

    it("never starts once stopped", () => {
        const voice = new AudioVoice(["amb/hum"], true, 1);
        voice.stop();
        expect(voice.isEnded()).toBe(true);
        start(voice);
        expect(context.sources).toEqual([]);
        expect(context.gains).toEqual([]);
    });

    it("hears a positioned sound through a gain, a muffler and a one-channel panner, at levels from where the camera is", () => {
        const range = 16;
        const position = {x: 4, y: 0, z: 0};
        const voice = new SpatialAudioVoice(["ui/blip"], false, 1, 1, position, range);
        start(voice);
        const [output, attenuation] = context.gains;
        const [muffler] = context.filters;
        const [panner] = context.panners;
        expect(context.sources[0].outputs).toEqual([output]);
        expect(output.outputs).toEqual([attenuation]);
        expect(attenuation.outputs).toEqual([muffler]);
        expect(muffler.type).toBe("lowpass");
        expect(muffler.outputs).toEqual([panner]);
        expect(panner.outputs).toEqual([context.destination]);
        expect([panner.channelCount, panner.channelCountMode]).toEqual([1, "explicit"]);

        const asked: unknown[] = [];
        voice.applyListener(ORIGIN, RIGHT, (from, to) => { asked.push([from, to]); return 0; }, 0);
        expect(asked).toEqual([[ORIGIN, position]]);
        expect(attenuation.gain.value).toBe(SpatialAudioUtil.getDistanceGain(4, range));
        expect(muffler.frequency.value).toBe(SPATIAL_AUDIO_OPEN_CUTOFF_HZ);
        expect(panner.pan.value).toBe(SpatialAudioUtil.getPan(ORIGIN, RIGHT, position));

        // Moved, and behind two walls.
        context.currentTime = 0.1;
        const moved = {x: -2, y: 0, z: 0};
        voice.setPosition(moved);
        voice.applyListener(ORIGIN, RIGHT, () => 2, 0.03);
        expect(attenuation.gain.events.slice(-1)[0]).toEqual({type: "target", time: 0.1, timeConstant: 0.03,
            value: SpatialAudioUtil.getDistanceGain(2, range) * SpatialAudioUtil.getOcclusionGain(2)});
        expect(muffler.frequency.events.slice(-1)[0]).toEqual(
            {type: "target", value: SpatialAudioUtil.getOcclusionCutoff(2), time: 0.1, timeConstant: 0.03});
        expect(panner.pan.events.slice(-1)[0]).toEqual({type: "target",
            value: SpatialAudioUtil.getPan(ORIGIN, RIGHT, moved), time: 0.1, timeConstant: 0.03});

        // Out of its range, where it is silent whatever is in between, so no walls are counted.
        voice.setPosition({x: range + 1, y: 0, z: 0});
        voice.applyListener(ORIGIN, RIGHT, () => { throw new Error("counted walls out of range"); }, 0.03);
        expect(attenuation.gain.target).toBe(0);
        expect(muffler.frequency.target).toBe(SPATIAL_AUDIO_OPEN_CUTOFF_HZ);

        context.advance(1);
        expect(voice.isEnded()).toBe(true);
        expect([attenuation.outputs, muffler.outputs, panner.outputs]).toEqual([[], [], []]);
    });

    it("streams a clip through an element into its output, and lets go of the element once it has played", async () => {
        const startStream = await streamStarter();
        const voice = new AudioVoice(["music/calm"], false, 1, 1.1);
        startStream(voice);
        await settle();
        const [element] = FakeMediaElement.instances;
        const [node] = context.mediaSources;
        expect(element.crossOrigin).toBe("anonymous");
        expect(element.src).toBe("https://assets.test/music/calm.mp3");
        expect([element.loop, element.playbackRate, element.preservesPitch, element.paused]).toEqual([false, 1.1, false, false]);
        expect(node.element).toBe(element);
        expect(node.outputs).toEqual([context.gains[0]]);

        element.end();
        expect(voice.isEnded()).toBe(true);
        expect(element.src).toBe("");
        expect(element.calls.slice(-2)).toEqual(["pause", "load"]);
        expect(node.outputs).toEqual([]);
        expect(context.gains[0].outputs).toEqual([]);

        // The next stream plays through the same element, which can feed the context through its one node alone.
        const next = new AudioVoice(["music/sea"], false, 1);
        startStream(next);
        expect(FakeMediaElement.instances).toEqual([element]);
        expect(context.mediaSources).toEqual([node]);
        expect(element.src).toBe("https://assets.test/music/sea.mp3");
        expect(node.outputs).toEqual([context.gains[1]]);
    });

    it("loops a stream by its element, and plays a sequence's files one after another, shuffled", async () => {
        const looped = new AudioVoice(["music/calm"], true, 1);
        await startStreamed(looped);
        expect(FakeMediaElement.instances[0].loop).toBe(true);

        const sequence = new AudioVoice(["music/calm", "music/sea", "music/bay"], true, 1);
        await startStreamed(sequence);
        const element = FakeMediaElement.instances[1];
        expect(element.loop).toBe(false);
        const played = [element.src];
        for (let i = 0; i < 12; ++i)
        {
            element.end();
            played.push(element.src);
        }
        for (let i = 1; i < played.length; ++i)
            expect(played[i]).not.toBe(played[i - 1]);
        expect(new Set(played).size).toBe(3);
        expect(sequence.isEnded()).toBe(false);
    });

    it("skips a file of a sequence that fails, until every one has, and ends a one-shot that fails", async () => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const sequence = new AudioVoice(["music/calm", "music/sea"], true, 1);
        await startStreamed(sequence);
        const element = FakeMediaElement.instances[0];
        const first = element.src;
        element.fail();
        expect(element.src).not.toBe(first);
        expect(sequence.isEnded()).toBe(false);
        element.fail();
        expect(sequence.isEnded()).toBe(true);

        const once = new AudioVoice(["music/calm"], false, 1);
        await startStreamed(once);
        FakeMediaElement.instances.slice(-1)[0].fail();
        expect(once.isEnded()).toBe(true);
        vi.restoreAllMocks();
    });

    it("lets go of a stream once a stop's fade is over", async () => {
        vi.useFakeTimers();
        const voice = new AudioVoice(["music/calm"], true, 1);
        await startStreamed(voice);
        const element = FakeMediaElement.instances[0];
        voice.stop();
        expect(element.src).not.toBe("");
        vi.advanceTimersByTime(1000 * AUDIO_STOP_FADE_SECONDS);
        expect(element.src).toBe("");
    });

    it("waits for the user's next input when the browser refuses a stream, and while the page is hidden", async () => {
        FakeMediaElement.mayPlay = false;
        const voice = new AudioVoice(["music/calm"], true, 1);
        await startStreamed(voice);
        await settle();
        const element = FakeMediaElement.instances[0];
        expect(element.paused).toBe(true);

        FakeMediaElement.mayPlay = true;
        page.input("pointerdown");
        await settle();
        expect(element.paused).toBe(false);

        page.setVisibility("hidden");
        expect(element.paused).toBe(true);
        page.input("keydown");
        expect(element.paused).toBe(true);
        page.setVisibility("visible");
        expect(element.paused).toBe(false);
    });
});

describe("the audio manager", () => {
    const MAP_PATH = "../../../src/client/audio/maps/audioBundleMap";
    const ASSETS_URL = "https://assets.test/app/assets";
    let page: FakePage;

    async function importAudioManager(map: AudioBundleInfo)
    {
        vi.resetModules();
        vi.doMock(MAP_PATH, () => ({default: map}));
        return {
            AudioManager: (await import("../../../src/client/audio/audioManager")).default,
            AudioContextUtil: (await import("../../../src/client/audio/util/audioContextUtil")).default,
        };
    }

    /** Loaded, with the user's first input made and the bundle decoded. */
    async function readyAudioManager(map: AudioBundleInfo = TEST_MAP)
    {
        const audio = await importAudioManager(map);
        audio.AudioManager.load(ASSETS_URL);
        page.input("pointerdown");
        await settle();
        return {...audio, context: FakeAudioContext.instances[0]};
    }

    beforeEach(() => {
        page = stubWebAudio();
        FakeAudioContext.decode = () => decodedBundle(TEST_MAP);
        graphics.camera = {matrixWorld: new THREE.Matrix4()};
        walls.count = 0;
        walls.asked.length = 0;
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.doUnmock(MAP_PATH);
    });

    it("loads nothing while there are no clips", async () => {
        const {AudioManager} = await importAudioManager(NO_CLIPS_MAP);
        AudioManager.load(ASSETS_URL);
        page.input("pointerdown");
        await settle();
        expect(page.fetched).toEqual([]);
        expect(FakeAudioContext.instances).toEqual([]);
        expect(page.numInputListeners()).toBe(0);
    });

    it("downloads the bundle once, at an address that changes with it, and none for streams alone", async () => {
        const {AudioManager} = await importAudioManager(TEST_MAP);
        AudioManager.load(ASSETS_URL);
        AudioManager.load(ASSETS_URL);
        await settle();
        expect(page.fetched).toEqual([`${ASSETS_URL}/${TEST_MAP.path}?v=${TEST_MAP.version}`]);

        page = stubWebAudio();
        const streamsAlone = await importAudioManager({...NO_CLIPS_MAP, streams: TEST_MAP.streams});
        streamsAlone.AudioManager.load(ASSETS_URL);
        page.input("pointerdown");
        await settle();
        expect(page.fetched).toEqual([]);
        expect(FakeAudioContext.instances.length).toBe(1);
    });

    it("makes no sound before the user's first input, dropping one-shots and keeping loops for it", async () => {
        const {AudioManager, AudioContextUtil} = await importAudioManager(TEST_MAP);
        AudioManager.load(ASSETS_URL);
        await settle();
        expect(FakeAudioContext.instances).toEqual([]);
        expect(AudioContextUtil.isAudible()).toBe(false);
        expect(AudioManager.play("ui/blip" as never).isEnded()).toBe(true);
        const loop = AudioManager.playLoop("amb/hum" as never);
        expect(loop.isEnded()).toBe(false);

        page.input("keydown");
        await settle();
        const [context] = FakeAudioContext.instances;
        expect(context.state).toBe("running");
        expect(AudioContextUtil.isAudible()).toBe(true);
        // The loop that waited has started; the one-shot that couldn't wait never does.
        expect(context.sources.length).toBe(1);
        expect(context.sources[0].loop).toBe(true);
        const once = AudioManager.play("ui/blip" as never, {rate: 1.1});
        expect(once.isEnded()).toBe(false);
        expect(context.sources.length).toBe(2);
        expect(context.sources[1].playbackRate.value).toBe(1.1);
    });

    it("streams a clip as soon as there is a context, without waiting for the bundle", async () => {
        FakeAudioContext.decode = () => new Promise(() => {});
        const {AudioManager} = await importAudioManager(TEST_MAP);
        AudioManager.load(ASSETS_URL);
        const music = AudioManager.playLoop(["music/calm", "music/sea"] as never[]);
        const hum = AudioManager.playLoop("amb/hum" as never);
        page.input("pointerdown");
        await settle();
        const [element] = FakeMediaElement.instances;
        expect(element.src).toMatch(new RegExp(`^${ASSETS_URL}/audio/music/(calm|sea)\\.mp3\\?v=`));
        expect(music.isEnded()).toBe(false);
        // The bundle never came, so the loop cut from it still waits.
        expect(FakeAudioContext.instances[0].sources).toEqual([]);
        expect(hum.isEnded()).toBe(false);

        // A stream asked for now, with the context there and the bundle still to come, plays at once.
        AudioManager.playLoop("music/sea" as never);
        await settle();
        expect(FakeMediaElement.instances[1]?.src).toMatch(new RegExp(`^${ASSETS_URL}/audio/music/sea\\.mp3\\?v=`));
    });

    it("makes its context at once on a page the user has already used", async () => {
        page = stubWebAudio({hasBeenActive: true});
        const {AudioManager, AudioContextUtil} = await importAudioManager(TEST_MAP);
        AudioManager.load(ASSETS_URL);
        await settle();
        expect(FakeAudioContext.instances.length).toBe(1);
        expect(AudioContextUtil.isAudible()).toBe(true);
        expect(AudioManager.play("ui/blip" as never).isEnded()).toBe(false);
    });

    it("waits for an input when the browser keeps the context from starting", async () => {
        page = stubWebAudio({hasBeenActive: true});
        FakeAudioContext.mayStart = false;
        const {AudioManager, AudioContextUtil} = await importAudioManager(TEST_MAP);
        AudioManager.load(ASSETS_URL);
        await settle();
        const [context] = FakeAudioContext.instances;
        expect(context.state).toBe("suspended");
        expect(AudioContextUtil.isAudible()).toBe(false);
        expect(AudioManager.play("ui/blip" as never).isEnded()).toBe(true);

        FakeAudioContext.mayStart = true;
        page.input("pointerup");
        await settle();
        expect(context.state).toBe("running");
        expect(AudioContextUtil.isAudible()).toBe(true);
        expect(FakeAudioContext.instances.length).toBe(1);
    });

    it("goes quiet while the page is hidden, dropping one-shots, and goes on where it was once shown", async () => {
        const {AudioManager, context} = await readyAudioManager();
        const music = AudioManager.playLoop(["music/a", "music/b"] as never[]);
        page.setVisibility("hidden");
        await settle();
        expect(context.state).toBe("suspended");
        expect(AudioManager.play("ui/blip" as never).isEnded()).toBe(true);
        expect(music.isEnded()).toBe(false);

        page.setVisibility("visible");
        await settle();
        expect(context.state).toBe("running");
        expect(AudioManager.play("ui/blip" as never).isEnded()).toBe(false);
    });

    it("hears a positioned sound from where the camera is, as it starts and on every frame, walls and all", async () => {
        const {AudioManager, context} = await readyAudioManager();
        const cameraAt = new THREE.Vector3(10, 2, 10);
        const camera = graphics.camera!.matrixWorld as THREE.Matrix4;
        camera.makeTranslation(cameraAt.x, cameraAt.y, cameraAt.z);

        // Straight away, with no easing in: 4 units to the camera's right, with nothing between.
        const voice = AudioManager.playLoopAt("amb/hum" as never, {x: 14, y: 2, z: 10});
        const [, attenuation] = context.gains;
        const [muffler] = context.filters;
        const [panner] = context.panners;
        expect(walls.asked).toEqual([{from: {x: 10, y: 2, z: 10}, to: {x: 14, y: 2, z: 10}}]);
        expect(attenuation.gain.value).toBeCloseTo(SpatialAudioUtil.getDistanceGain(4, SPATIAL_AUDIO_DEFAULT_RANGE), 12);
        expect(muffler.frequency.value).toBe(SPATIAL_AUDIO_OPEN_CUTOFF_HZ);
        expect(panner.pan.value).toBeCloseTo(SPATIAL_AUDIO_MAX_PAN, 12);

        // The camera turns half round, so it is on the left, now behind a wall.
        walls.count = 1;
        camera.compose(cameraAt, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
            new THREE.Vector3(1, 1, 1));
        AudioManager.update();
        expect(panner.pan.events.slice(-1)[0]).toMatchObject({type: "target", timeConstant: SPATIAL_AUDIO_SMOOTHING_SECONDS});
        expect(panner.pan.target).toBeCloseTo(-SPATIAL_AUDIO_MAX_PAN, 12);
        expect(attenuation.gain.target).toBeCloseTo(
            SpatialAudioUtil.getDistanceGain(4, SPATIAL_AUDIO_DEFAULT_RANGE) * SPATIAL_AUDIO_WALL_GAIN, 12);
        expect(muffler.frequency.target).toBe(SPATIAL_AUDIO_WALL_CUTOFF_HZ);

        // It moves on, farther off and straight behind, past more walls than count.
        walls.count = SPATIAL_AUDIO_MAX_OCCLUDING_WALLS + 2;
        voice.setPosition({x: 10, y: 2, z: 2});
        AudioManager.update();
        expect(attenuation.gain.target).toBeCloseTo(SpatialAudioUtil.getDistanceGain(8, SPATIAL_AUDIO_DEFAULT_RANGE)
            * SpatialAudioUtil.getOcclusionGain(SPATIAL_AUDIO_MAX_OCCLUDING_WALLS), 12);
        expect(panner.pan.target).toBeCloseTo(0, 12);

        // A range and a volume of its own.
        walls.count = 0;
        AudioManager.playAt("ui/blip" as never, {x: 10, y: 2, z: 13}, {range: 4, volume: 0.5});
        const [, , blipOutput, blipAttenuation] = context.gains;
        expect(blipOutput.gain.value).toBe(0.5);
        expect(blipAttenuation.gain.value).toBeCloseTo(SpatialAudioUtil.getDistanceGain(3, 4), 12);
    });

    it("stops what was positioned in the room it leaves, and lets everything else play on", async () => {
        const {AudioManager} = await readyAudioManager();
        const music = AudioManager.playLoop(["music/a", "music/b"] as never[]);
        const hum = AudioManager.playLoopAt("amb/hum" as never, ORIGIN);
        const blip = AudioManager.playAt("ui/blip" as never, ORIGIN);
        AudioManager.unload();
        expect(hum.isEnded()).toBe(true);
        expect(blip.isEnded()).toBe(true);
        expect(music.isEnded()).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Stopped 1 positioned loops"));
    });

    it("stops a positioned loop still waiting for the bundle when the room it was in goes, and keeps one with no position", async () => {
        const {AudioManager} = await importAudioManager(TEST_MAP);
        AudioManager.load(ASSETS_URL);
        const hum = AudioManager.playLoopAt("amb/hum" as never, ORIGIN);
        const music = AudioManager.playLoop(["music/a", "music/b"] as never[]);
        AudioManager.unload();
        page.input("pointerdown");
        await settle();
        expect(hum.isEnded()).toBe(true);
        expect(music.isEnded()).toBe(false);
        // The music's first clip, and the next waiting behind it.
        expect(FakeAudioContext.instances[0].sources.length).toBe(2);
    });

    it("refuses a clip there isn't, or clips from the bundle and streams in one voice, saying so once", async () => {
        const {AudioManager, context} = await readyAudioManager();
        expect(AudioManager.play("none" as never).isEnded()).toBe(true);
        expect(AudioManager.playLoop(["music/a", "none"] as never[]).isEnded()).toBe(true);
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith("AudioManager :: Unknown clip (clip = none)");
        expect(AudioManager.playLoop(["music/a", "music/calm"] as never[]).isEnded()).toBe(true);
        expect(console.warn).toHaveBeenCalledTimes(2);
        expect(context.sources).toEqual([]);
        expect(FakeMediaElement.instances).toEqual([]);
    });

    it("cuts every clip from where this browser's decoder put it", async () => {
        const shift = 0.026;
        FakeAudioContext.decode = () => decodedBundle(TEST_MAP, shift);
        const {AudioManager, context} = await readyAudioManager();
        AudioManager.play("ui/blip" as never);
        expect(Math.abs(context.sources[0].started!.offset - (TEST_MAP.clips["ui/blip"].start + shift)))
            .toBeLessThanOrEqual(1 / context.sampleRate);
    });

    it("stops the loops that waited for a bundle that failed to download, and plays nothing from it", async () => {
        page = stubWebAudio({fetchFails: true});
        const {AudioManager} = await importAudioManager(TEST_MAP);
        AudioManager.load(ASSETS_URL);
        const loop = AudioManager.playLoop("amb/hum" as never);
        page.input("pointerdown");
        await settle();
        expect(loop.isEnded()).toBe(true);
        expect(console.warn).toHaveBeenCalledWith("AudioManager :: Failed to load the audio bundle", expect.anything());
        expect(AudioManager.play("ui/blip" as never).isEnded()).toBe(true);
        // Streams don't need it.
        expect(AudioManager.playLoop("music/calm" as never).isEnded()).toBe(false);
    });
});
