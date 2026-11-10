import crypto from "crypto";
import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import FileUtil from "../util/fileUtil";
import WavFileUtil from "../util/wavFileUtil";
import AudioResampleUtil from "../util/audioResampleUtil";
import Mp3EncodeUtil, { MP3_VBR_QUALITY } from "../util/mp3EncodeUtil";
import ProceduralSoundUtil from "../util/proceduralSoundUtil";
import ProceduralSoundSpec from "../types/proceduralSoundSpec";
import { ProceduralSounds } from "../data/proceduralSounds";
import { SRC_ROOT_DIR, STATIC_PAGE_ROOT_DIR } from "../../system/serverConstants";

export const AUDIO_BUNDLE_SAMPLE_RATE = 44100;
// What lies on either side of each clip: silence, which takes in what the encoder smears across the clip's edges. A
// looping clip's own other end lies there instead, so that its seam is encoded as it sounds when it loops.
export const AUDIO_CLIP_PADDING_SECONDS = 0.05;
// Where the click lies that shows how far a decoder shifts every clip (see AudioBundleUtil.findMarkerOffset): this far
// into the bundle, with twice as much silence after it before the first clip's padding.
export const AUDIO_MARKER_TIME = 0.1;
// The longest a clip in the bundle may be. The whole bundle downloads before any clip plays and stays decoded in memory,
// so anything longer streams from an MP3 file of its own.
export const AUDIO_MAX_BUNDLED_SECONDS = 10;
export const AUDIO_BUNDLE_FILE_NAME = "bundle.mp3";

const ROOT_DIR_NAME = "audio";
const MANIFEST_FILE_NAME = "manifest.json";

// Makes the clips the game plays (see docs/audio/audio.md) and writes where each is to AudioBundleMap. The game's own
// sounds (see ProceduralSounds), and each WAV file the audio manifest lists, go into one MP3 the game downloads once; an
// MP3 file the manifest lists streams from where it is. The bundle is encoded only when what it is made of changes, so
// SSG needs no encoder until then.
export default class AudioBundleBuilder
{
    private readonly rootPath: string;
    private readonly mapFilePath: string;
    private readonly encode: (pcm: Buffer, numChannels: number, sampleRate: number, filePath: string) => Promise<void>;
    private readonly proceduralSounds: ProceduralSoundSpec[];

    constructor(options?: {rootPath?: string, mapFilePath?: string,
        encode?: (pcm: Buffer, numChannels: number, sampleRate: number, filePath: string) => Promise<void>,
        proceduralSounds?: ProceduralSoundSpec[]})
    {
        this.rootPath = options?.rootPath
            ?? FileUtil.getAbsoluteFilePath(ROOT_DIR_NAME, `${STATIC_PAGE_ROOT_DIR}/app/assets`);
        this.mapFilePath = options?.mapFilePath
            ?? FileUtil.getAbsoluteFilePath("audioBundleMap.ts", `${SRC_ROOT_DIR}/client/audio/maps`);
        this.encode = options?.encode ?? Mp3EncodeUtil.encode;
        this.proceduralSounds = options?.proceduralSounds ?? ProceduralSounds;
    }

    async build(): Promise<void>
    {
        const {mapText, version, pcm, numChannels} = await this.plan();
        const bundlePath = path.join(this.rootPath, AUDIO_BUNDLE_FILE_NAME);
        const previousMapText = await readTextIfAny(this.mapFilePath);
        if (pcm == undefined)
            await fs.rm(bundlePath, {force: true});
        else if (readBundleVersion(previousMapText) != version || !existsSync(bundlePath))
        {
            try
            {
                await this.encode(pcm, numChannels, AUDIO_BUNDLE_SAMPLE_RATE, bundlePath);
            }
            catch (err)
            {
                throw new Error(`Audio bundle generation failed :: The clips changed, and encoding them failed (${getReason(err)})`);
            }
        }
        // Only when it changes, since the dev server restarts when it does (see SSG).
        if (previousMapText != mapText)
            await fs.writeFile(this.mapFilePath, mapText);
    }

    // The bundle's samples (interleaved 16-bit little-endian, undefined while it holds no clip) and the map of it and of the
    // streams, with nothing encoded or written.
    async plan(): Promise<{mapText: string, version: string, clips: [string, {start: number, duration: number}][],
        streams: [string, {path: string, version: string}][], pcm?: Buffer, numChannels: number}>
    {
        const {bundled, streams} = await this.readClips();
        if (bundled.length == 0)
            return {mapText: getMapText("", "", [], streams), version: "", clips: [], streams, numChannels: 0};

        const rate = AUDIO_BUNDLE_SAMPLE_RATE;
        const numChannels = Math.max(...bundled.map(clip => clip.channels.length));
        const padding = Math.round(AUDIO_CLIP_PADDING_SECONDS * rate);
        const markerIndex = Math.round(AUDIO_MARKER_TIME * rate);
        let numFrames = 3 * markerIndex;
        const starts = bundled.map(clip => {
            const start = numFrames + padding;
            numFrames = start + clip.channels[0].length + padding;
            return start;
        });

        const pcm = Buffer.alloc(numFrames * numChannels * 2);
        const write = (frame: number, channel: number, value: number) => pcm.writeInt16LE(
            Math.max(-32768, Math.min(32767, Math.round(value * 32767))), (frame * numChannels + channel) * 2);
        for (let c = 0; c < numChannels; ++c)
            write(markerIndex, c, 1);
        bundled.forEach((clip, i) => {
            const length = clip.channels[0].length;
            const from = clip.loop ? -padding : 0;
            const to = clip.loop ? length + padding : length;
            for (let c = 0; c < numChannels; ++c)
            {
                // A mono clip is heard alike from both sides.
                const samples = clip.channels[Math.min(c, clip.channels.length - 1)];
                for (let k = from; k < to; ++k)
                    write(starts[i] + k, c, samples[((k % length) + length) % length]);
            }
        });

        const version = crypto.createHash("sha256").update(pcm)
            .update(`${numChannels},${rate},${MP3_VBR_QUALITY}`).digest("hex").slice(0, 16);
        const clips = bundled.map((clip, i): [string, {start: number, duration: number}] =>
            [clip.name, {start: starts[i] / rate, duration: clip.channels[0].length / rate}]);
        return {mapText: getMapText(`${ROOT_DIR_NAME}/${AUDIO_BUNDLE_FILE_NAME}`, version, clips, streams), version, clips,
            streams, pcm, numChannels};
    }

    // The game's own sounds, then the manifest's clips in its order: those for the bundle at its rate, and the streams.
    private async readClips(): Promise<{bundled: {name: string, loop: boolean, channels: Float32Array[]}[],
        streams: [string, {path: string, version: string}][]}>
    {
        const bundled: {name: string, loop: boolean, channels: Float32Array[]}[] = [];
        const streams: [string, {path: string, version: string}][] = [];
        const names: Set<string> = new Set();
        const claimName = (name: unknown, where: string): string => {
            if (typeof name != "string" || name.length == 0)
                throw new Error(`Audio bundle generation failed :: ${where} names a clip with no name`);
            if (names.has(name))
                throw new Error(`Audio bundle generation failed :: "${name}" names two clips (the second in ${where})`);
            names.add(name);
            return name;
        };

        for (const spec of this.proceduralSounds)
        {
            const name = claimName(spec.name, "ProceduralSounds");
            const channels = [ProceduralSoundUtil.render(spec, AUDIO_BUNDLE_SAMPLE_RATE)];
            checkBundledLength(channels, `the procedural sound "${name}"`);
            bundled.push({name, loop: spec.loop === true, channels});
        }

        const manifest = JSON.parse(await fs.readFile(path.join(this.rootPath, MANIFEST_FILE_NAME), "utf8")) as
            {clips?: {name?: unknown, file?: unknown, loop?: unknown}[]};
        if (!Array.isArray(manifest.clips))
            throw new Error(`Audio bundle generation failed :: ${MANIFEST_FILE_NAME} has no list of clips`);
        for (const entry of manifest.clips)
        {
            const name = claimName(entry.name, MANIFEST_FILE_NAME);
            const file = entry.file;
            if (typeof file != "string" || file.length == 0)
                throw new Error(`Audio bundle generation failed :: ${MANIFEST_FILE_NAME} gives "${name}" no file`);
            const extension = path.extname(file).toLowerCase();
            if (extension != ".wav" && extension != ".mp3")
                throw new Error(`Audio bundle generation failed :: "${file}" is neither a WAV file, which goes in the bundle, nor an MP3 file, which streams`);

            let bytes: Buffer;
            try
            {
                bytes = await fs.readFile(path.join(this.rootPath, file));
            }
            catch (err)
            {
                throw new Error(`Audio bundle generation failed :: "${file}" can't be read (${getReason(err)})`);
            }
            if (extension == ".mp3")
            {
                streams.push([name, {path: `${ROOT_DIR_NAME}/${file}`,
                    version: crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 16)}]);
                continue;
            }

            const loop = entry.loop === true;
            let channels: Float32Array[];
            try
            {
                const audio = WavFileUtil.decode(bytes);
                channels = audio.channels.map(samples =>
                    AudioResampleUtil.resample(samples, audio.sampleRate, AUDIO_BUNDLE_SAMPLE_RATE, loop));
            }
            catch (err)
            {
                throw new Error(`Audio bundle generation failed :: "${file}" can't be read (${getReason(err)})`);
            }
            if (channels.length > 2)
                throw new Error(`Audio bundle generation failed :: "${file}" has ${channels.length} channels, and a clip has one or two`);
            if (channels[0].length == 0)
                throw new Error(`Audio bundle generation failed :: "${file}" holds no sound`);
            checkBundledLength(channels, `"${file}"`);
            bundled.push({name, loop, channels});
        }
        return {bundled, streams};
    }
}

function checkBundledLength(channels: Float32Array[], what: string): void
{
    const seconds = channels[0].length / AUDIO_BUNDLE_SAMPLE_RATE;
    if (seconds > AUDIO_MAX_BUNDLED_SECONDS)
        throw new Error(`Audio bundle generation failed :: ${what} is ${seconds.toFixed(1)} s long, and a clip in the bundle is ${AUDIO_MAX_BUNDLED_SECONDS} s at most: an MP3 file streams instead`);
}

function getMapText(bundlePath: string, version: string, clips: [string, {start: number, duration: number}][],
    streams: [string, {path: string, version: string}][]): string
{
    const clipsText = getEntriesText(clips.map(([name, clip]) =>
        `${JSON.stringify(name)}: {start: ${clip.start}, duration: ${clip.duration}},`));
    const streamsText = getEntriesText(streams.map(([name, stream]) =>
        `${JSON.stringify(name)}: {path: ${JSON.stringify(stream.path)}, version: ${JSON.stringify(stream.version)}},`));
    // The import path is relative to the generated file.
    return `// THIS FILE IS AUTO-GENERATED BY AudioBundleBuilder. DO NOT EDIT MANUALLY.
import AudioBundleInfo from "../types/audioBundleInfo";

const AudioBundleMap = {
    path: ${JSON.stringify(bundlePath)},
    version: ${JSON.stringify(version)},
    markerTime: ${AUDIO_MARKER_TIME},
    clips: ${clipsText},
    streams: ${streamsText},
} as const satisfies AudioBundleInfo;

export default AudioBundleMap;
`;
}

function getEntriesText(lines: string[]): string
{
    return (lines.length == 0) ? "{}" : `{\n${lines.map(line => `        ${line}`).join("\n")}\n    }`;
}

// The bundle's version the map was last written with, or undefined if there is none.
function readBundleVersion(mapText: string | undefined): string | undefined
{
    return mapText?.match(/^ {4}version: "([0-9a-f]*)",$/m)?.[1];
}

function getReason(err: unknown): string
{
    return (err instanceof Error) ? err.message : String(err);
}

async function readTextIfAny(filePath: string): Promise<string | undefined>
{
    try
    {
        return await fs.readFile(filePath, "utf8");
    }
    catch
    {
        return undefined;
    }
}
