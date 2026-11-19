import * as THREE from "three";
import Vec3 from "../../shared/math/types/vec3";
import GraphicsManager from "../graphics/graphicsManager";
import ClientVoxelQueryUtil from "../voxel/util/clientVoxelQueryUtil";
import AudioBundleMap from "./maps/audioBundleMap";
import AudioBundleInfo from "./types/audioBundleInfo";
import AudioClipName from "./types/audioClipName";
import AudioPlayOptions from "./types/audioPlayOptions";
import SpatialAudioPlayOptions from "./types/spatialAudioPlayOptions";
import AudioVoice from "./types/audioVoice";
import SpatialAudioVoice from "./types/spatialAudioVoice";
import DecodedAudioBundle from "./types/decodedAudioBundle";
import BundledClipPlayer from "./types/bundledClipPlayer";
import StreamedClipPlayer from "./types/streamedClipPlayer";
import AudioBundleUtil from "./util/audioBundleUtil";
import AudioContextUtil from "./util/audioContextUtil";
import { SPATIAL_AUDIO_DEFAULT_RANGE, SPATIAL_AUDIO_MAX_OCCLUDING_WALLS } from "./util/spatialAudioUtil";

// How quickly a positioned sound follows its source and the camera from one frame to the next, the walls between them
// included.
export const SPATIAL_AUDIO_SMOOTHING_SECONDS = 0.04;

const map: AudioBundleInfo = AudioBundleMap;
let assetsURL = "";
let loadStarted = false;
let bundle: DecodedAudioBundle | undefined;
// Loops asked for before what they play from could be played from, which start as soon as it can: the bundle, once
// decoded, or a stream, once there is a context.
let waitingVoices: AudioVoice[] = [];
const spatialVoices: Set<SpatialAudioVoice> = new Set();
const listenerPosition = new THREE.Vector3();
const listenerRight = new THREE.Vector3(1, 0, 0);
const wallFromTemp = new THREE.Vector3();
const wallToTemp = new THREE.Vector3();
const problemsTold: Set<string> = new Set();

// Sound (see docs/audio/audio.md). Short clips are cut from one bundled file, downloaded and decoded once; long ones
// stream from files of their own. A sound played at a position in the world fades as the camera gets farther from it, is
// muffled by the walls in between, and is heard from the side it is on; one played without a position keeps the volume
// it is given.
const AudioManager =
{
    // Downloads the bundle, once. Nothing plays before the user's first input lets the page make sound.
    load: (url: string): void =>
    {
        const hasClips = Object.keys(map.clips).length > 0;
        if (loadStarted || (!hasClips && Object.keys(map.streams).length == 0))
            return;
        loadStarted = true;
        assetsURL = url;
        const bytes = hasClips ? AudioBundleUtil.download(`${url}/${map.path}?v=${map.version}`) : undefined;
        // A failure is reported where the bytes are awaited, which may be long after.
        bytes?.catch(() => {});
        AudioContextUtil.install(context => {
            startWaitingVoices(isStreamed);
            if (bytes != undefined)
                void decodeBundle(context, bytes);
        });
    },
    // After the frame is drawn, so that what is heard comes from where the camera drew it.
    update: (): void =>
    {
        if (spatialVoices.size == 0)
            return;
        updateListener();
        for (const voice of spatialVoices)
        {
            if (voice.isEnded())
                spatialVoices.delete(voice);
            else
                voice.applyListener(listenerPosition, listenerRight, countWalls, SPATIAL_AUDIO_SMOOTHING_SECONDS);
        }
    },
    // Between rooms, after every object has let go of what it played: what was positioned in the room left behind
    // stops with it.
    unload: (): void =>
    {
        let numLeakedLoops = 0;
        for (const voice of spatialVoices)
        {
            if (voice.looping && !voice.isEnded())
                ++numLeakedLoops;
            voice.stop();
        }
        spatialVoices.clear();
        waitingVoices = waitingVoices.filter(voice => !voice.isEnded());
        if (numLeakedLoops > 0)
            console.warn(`AudioManager.unload :: Stopped ${numLeakedLoops} positioned loops their owners never did`);
    },
    // A clip once, at a fixed volume.
    play: (clip: AudioClipName, options?: AudioPlayOptions): AudioVoice =>
    {
        return launch(new AudioVoice([clip], false, options?.volume ?? 1, options?.rate ?? 1));
    },
    // A clip once, at a position in the world, which its owner may move while it plays.
    playAt: (clip: AudioClipName, position: Vec3, options?: SpatialAudioPlayOptions): SpatialAudioVoice =>
    {
        return launch(new SpatialAudioVoice([clip], false, options?.volume ?? 1, options?.rate ?? 1, position,
            options?.range ?? SPATIAL_AUDIO_DEFAULT_RANGE));
    },
    // One clip over and over, or several one after another in an endless shuffled order, at a fixed volume, until
    // stopped. Clips from the bundle and streams don't mix in one.
    playLoop: (clips: AudioClipName | readonly AudioClipName[], options?: AudioPlayOptions): AudioVoice =>
    {
        return launch(new AudioVoice(toList(clips), true, options?.volume ?? 1, options?.rate ?? 1));
    },
    // The same at a position in the world, which its owner may move while it plays.
    playLoopAt: (clips: AudioClipName | readonly AudioClipName[], position: Vec3,
        options?: SpatialAudioPlayOptions): SpatialAudioVoice =>
    {
        return launch(new SpatialAudioVoice(toList(clips), true, options?.volume ?? 1, options?.rate ?? 1, position,
            options?.range ?? SPATIAL_AUDIO_DEFAULT_RANGE));
    },
}

function toList(clips: AudioClipName | readonly AudioClipName[]): readonly string[]
{
    return (typeof clips == "string") ? [clips] : clips;
}

// A clip played once is heard now or never: started while the page can't make sound, it would go off later with
// whatever else had been saved up. A loop waits.
function launch<Voice extends AudioVoice>(voice: Voice): Voice
{
    const problem = getProblem(voice.clips);
    if (problem != undefined && !problemsTold.has(problem))
    {
        problemsTold.add(problem);
        console.warn(`AudioManager :: ${problem}`);
    }
    const ready = isStreamed(voice) ? AudioContextUtil.get() != undefined : bundle != undefined;
    if (problem != undefined || (!voice.looping && (!ready || !AudioContextUtil.isAudible())))
    {
        voice.stop(0);
        return voice;
    }
    if (voice instanceof SpatialAudioVoice)
        spatialVoices.add(voice);
    if (ready)
        startVoice(voice);
    else
        waitingVoices.push(voice);
    return voice;
}

// Why the clips can't play as one voice, or undefined if they can.
function getProblem(clips: readonly string[]): string | undefined
{
    if (clips.length == 0)
        return "No clip to play";
    const unknown = clips.find(clip => !hasOwn(map.clips, clip) && !hasOwn(map.streams, clip));
    if (unknown != undefined)
        return `Unknown clip (clip = ${unknown})`;
    if (clips.some(clip => hasOwn(map.streams, clip)) && clips.some(clip => hasOwn(map.clips, clip)))
        return `Clips from the bundle and streams in one voice (clips = ${clips.join(", ")})`;
    return undefined;
}

function isStreamed(voice: AudioVoice): boolean
{
    return hasOwn(map.streams, voice.clips[0]);
}

function hasOwn(entries: object, clip: string): boolean
{
    return Object.prototype.hasOwnProperty.call(entries, clip);
}

function startVoice(voice: AudioVoice): void
{
    const context = AudioContextUtil.get()!;
    voice.start(context, context.destination, (output, onFinished, onReleased) => isStreamed(voice)
        ? new StreamedClipPlayer(context, output, getStreamURL, voice.clips, voice.looping, voice.rate, onFinished,
            onReleased)
        : new BundledClipPlayer(context, output, bundle!, voice.clips, voice.looping, voice.rate, onFinished,
            onReleased));
    if (voice instanceof SpatialAudioVoice)
    {
        updateListener();
        voice.applyListener(listenerPosition, listenerRight, countWalls, 0);
    }
}

function startWaitingVoices(canStart: (voice: AudioVoice) => boolean): void
{
    const starting = waitingVoices.filter(canStart);
    waitingVoices = waitingVoices.filter(voice => !canStart(voice));
    for (const voice of starting)
        startVoice(voice);
}

async function decodeBundle(context: AudioContext, bytes: Promise<ArrayBuffer>): Promise<void>
{
    try
    {
        bundle = await AudioBundleUtil.decode(context, await bytes, map);
    }
    catch (err)
    {
        console.warn("AudioManager :: Failed to load the audio bundle", err);
        for (const voice of waitingVoices.filter(voice => !isStreamed(voice)))
            voice.stop(0);
        waitingVoices = waitingVoices.filter(isStreamed);
        return;
    }
    startWaitingVoices(voice => !isStreamed(voice));
}

function getStreamURL(clip: string): string
{
    const stream = map.streams[clip];
    return `${assetsURL}/${stream.path}?v=${stream.version}`;
}

function countWalls(from: Vec3, to: Vec3): number
{
    return ClientVoxelQueryUtil.countDrawnVoxelBlocksBetween(wallFromTemp.set(from.x, from.y, from.z),
        wallToTemp.set(to.x, to.y, to.z), SPATIAL_AUDIO_MAX_OCCLUDING_WALLS);
}

// From the camera as last drawn, which is at most a frame old.
function updateListener(): void
{
    const camera = GraphicsManager.getCamera();
    if (camera == undefined)
        return;
    listenerPosition.setFromMatrixPosition(camera.matrixWorld);
    listenerRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
}

export default AudioManager;
