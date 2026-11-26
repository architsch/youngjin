/**
 * A pet's voice (see PetVoiceUtil, PetVoice), with the audio itself stood in for: each line said aloud as a babble of
 * the voice's syllables, as many as the line is long and never one twice running, its tune by the face it is said with
 * (higher glad than plain, lower sad or cross, rising at a question, hurried when excited), running down as it asks for
 * a battery, now and then with one robot's sound among its syllables, never always; a pet's own pitch, the same every
 * time; the feelings a change in what a pet shows sounds as with no words, and none for what words voice; one sound at a
 * time from where the pet is, a line cutting short what was said, a feeling sounding a frame later unless a line comes
 * with it, a sudden one cutting in and any other let go, and the same one not again soon; and every clip the voice plays
 * made among the game's own sounds, and every one made for it played.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

type Voice = {stops: number, ended: boolean, positions: {x: number, y: number, z: number}[], isEnded: () => boolean,
    stop: () => void, setPosition: (position: {x: number, y: number, z: number}) => void};
const audio = vi.hoisted(() => ({calls: [] as {method: string, clips: string[], position: {x: number, y: number, z: number},
    options: any, voice: Voice}[]}));
vi.mock("../../../src/client/audio/audioManager", () => {
    const record = (method: string, clips: string[], position: {x: number, y: number, z: number}, options: any) => {
        const voice: Voice = {stops: 0, ended: false, positions: [], isEnded() { return this.ended || this.stops > 0; },
            stop() { ++this.stops; }, setPosition(at) { this.positions.push({...at}); }};
        audio.calls.push({method, clips, position: {...position}, options, voice});
        return voice;
    };
    return {default: {
        playAt: (clip: string, position: any, options: any) => record("playAt", [clip], position, options),
        playPhraseAt: (parts: {clip: string}[], position: any, options: any) =>
            record("playPhraseAt", parts.map(part => part.clip), position, options),
    }};
});

import PetVoiceUtil, { PET_BABBLE_SYLLABLES, PET_CHARS_PER_SYLLABLE, PET_FEELING_VOLUME, PET_VOICE_PITCHES,
    PET_VOICE_RANGE, PET_VOICE_VOLUME } from "../../../src/client/audio/util/petVoiceUtil";
import PetVoice, { PET_FEELING_REPEAT_MS } from "../../../src/client/audio/types/petVoice";
import AudioPhrasePart from "../../../src/client/audio/types/audioPhrasePart";
import AudioBundleMap from "../../../src/client/audio/maps/audioBundleMap";
import { ProceduralSounds } from "../../../src/server/ssg/data/proceduralSounds";
import { PetActionEnumMap } from "../../../src/shared/object/types/petAction";
import { PetExpressionEnumMap } from "../../../src/shared/object/types/petExpression";
import PetShownState from "../../../src/shared/object/types/petShownState";
import { PetSpeechToneEnumMap } from "../../../src/shared/object/types/petSpeechTone";
import PetShownStateUtil from "../../../src/shared/object/util/petShownStateUtil";

const A = PetActionEnumMap;
const E = PetExpressionEnumMap;
const AT = {x: 1, y: 2, z: 3};
const ELSEWHERE = {x: 4, y: 2, z: 6};
const CLIPS = PetVoiceUtil.getClips();
const TRIALS = 300;

function shows(changes: Partial<PetShownState> = {}): PetShownState
{
    return {...PetShownStateUtil.decode(""), ...changes};
}

// Mulberry32, so that each trial is the same every run.
function seeded(seed: number): () => number
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

function syllablesOf(parts: AudioPhrasePart[]): AudioPhrasePart[]
{
    return parts.filter(part => CLIPS.syllables.includes(part.clip));
}

// Over many babbles of a line said so: the mean of their syllables' pitches (in octaves), and of how long each syllable
// takes, onset to onset.
function measure(text: string, shown: PetShownState): {pitch: number, pace: number}
{
    let pitch = 0, pace = 0, count = 0;
    for (let seed = 0; seed < TRIALS; ++seed)
    {
        const syllables = syllablesOf(PetVoiceUtil.compose(text, shown, 1, seeded(seed)));
        pitch += syllables.reduce((sum, part) => sum + Math.log2(part.rate), 0);
        pace += (syllables[syllables.length - 1].at - syllables[0].at) / (syllables.length - 1);
        count += syllables.length;
    }
    return {pitch: pitch / count, pace: pace / TRIALS};
}

beforeEach(() => {
    audio.calls.length = 0;
});

describe("a pet's babble", () => {
    it("has a syllable of its voice for every few characters of its line, within bounds, never one twice running", () => {
        const meanCounts: number[] = [];
        for (const length of [1, 12, 30, 72])
        {
            let total = 0;
            for (let seed = 0; seed < TRIALS; ++seed)
            {
                const parts = PetVoiceUtil.compose("x".repeat(length), shows(), 1, seeded(seed));
                const syllables = syllablesOf(parts);
                total += syllables.length;
                const within = (count: number) => Math.min(PET_BABBLE_SYLLABLES[1], Math.max(PET_BABBLE_SYLLABLES[0], count));
                const wanted = Math.round(length / PET_CHARS_PER_SYLLABLE);
                expect(syllables.length).toBeGreaterThanOrEqual(within(wanted - 1));
                expect(syllables.length).toBeLessThanOrEqual(within(wanted + 1));
                syllables.forEach((part, i) => expect(part.clip).not.toBe(syllables[i - 1]?.clip));
                // One after another, each a little louder or softer than full, and at most one robot's sound among them.
                parts.forEach((part, i) => expect(part.at).toBeGreaterThan(parts[i - 1]?.at ?? -1));
                expect(parts.every(part => part.volume > 0 && part.volume <= 1.1)).toBe(true);
                expect(parts.length - syllables.length).toBeLessThanOrEqual(1);
            }
            meanCounts.push(total / TRIALS);
        }
        meanCounts.forEach((count, i) => expect(count).toBeGreaterThan(meanCounts[i - 1] ?? 0));
    });

    it("now and then has a robot's sound among its syllables, at its start, at its end or between words, never always", () => {
        const places = {start: 0, end: 0, between: 0};
        for (let seed = 0; seed < TRIALS; ++seed)
        {
            const parts = PetVoiceUtil.compose("x".repeat(40), shows(), 1, seeded(seed));
            const at = parts.findIndex(part => CLIPS.robotSounds.includes(part.clip));
            if (at >= 0)
                ++places[(at == 0) ? "start" : (at == parts.length - 1) ? "end" : "between"];
        }
        const share = (places.start + places.end + places.between) / TRIALS;
        expect(share).toBeGreaterThan(0.2);
        expect(share).toBeLessThan(0.5);
        expect(Object.values(places).every(count => count > 0)).toBe(true);
    });

    it("is in the tune of the face it is said with: higher glad, lower sad or cross, hurried when excited", () => {
        const line = "x".repeat(40);
        const plain = measure(line, shows());
        const glad = measure(line, shows({expression: E.Happy}));
        const sad = measure(line, shows({expression: E.Sad}));
        const cross = measure(line, shows({expression: E.Angry}));
        const panicked = measure(line, shows({expression: E.Panicked, excited: true}));
        expect(glad.pitch).toBeGreaterThan(plain.pitch);
        expect(sad.pitch).toBeLessThan(plain.pitch);
        expect(cross.pitch).toBeLessThan(plain.pitch);
        expect(panicked.pitch).toBeGreaterThan(glad.pitch);
        // Slower sad, quicker in a panic.
        expect(sad.pace).toBeGreaterThan(plain.pace);
        expect(panicked.pace).toBeLessThan(plain.pace);
        expect(measure(line, shows({expression: E.Happy, excited: true})).pace).toBeLessThan(glad.pace);
    });

    it("rises at the end of a question, as at no other line's", () => {
        const lastRise = (text: string) => {
            let rise = 0;
            for (let seed = 0; seed < TRIALS; ++seed)
            {
                const syllables = syllablesOf(PetVoiceUtil.compose(text, shows(), 1, seeded(seed)));
                rise += Math.log2(syllables[syllables.length - 1].rate / syllables[0].rate);
            }
            return rise / TRIALS;
        };
        expect(lastRise(`${"x".repeat(30)}?`)).toBeGreaterThan(lastRise(`${"x".repeat(30)}.`) + 0.2);
        // Wherever its markup is: what a bubble shows ends in its question.
        expect(lastRise(`Give me <control name="battery"/>, please?`)).toBeGreaterThan(lastRise(`${"x".repeat(30)}.`) + 0.2);
    });

    it("asks for a battery after the notes of its battery running down, then runs down as it speaks; and falls slow and faint asking for a wrench", () => {
        for (let seed = 0; seed < TRIALS; ++seed)
        {
            const parts = PetVoiceUtil.compose("x".repeat(40), shows({expression: E.Sad,
                tone: PetSpeechToneEnumMap.Powerless}), 1, seeded(seed));
            expect(parts[0].clip).toBe(PetVoiceUtil.getFeelingClip("powerDown"));
            expect(parts.filter(part => part.clip == parts[0].clip)).toHaveLength(1);
            const syllables = syllablesOf(parts);
            expect(syllables.length).toBe(parts.length - 1);
            expect(syllables[0].at).toBeGreaterThan(parts[0].at);
            const [first, last] = [syllables[0], syllables[syllables.length - 1]];
            expect(last.rate).toBeLessThan(first.rate);
            expect(last.volume).toBeLessThan(first.volume);
        }
        const sad = measure("x".repeat(40), shows({expression: E.Sad}));
        const dying = measure("x".repeat(40), shows({expression: E.Neutral, tone: PetSpeechToneEnumMap.Dying}));
        expect(dying.pitch).toBeLessThan(sad.pitch);
        expect(dying.pace).toBeGreaterThan(sad.pace);
    });

    it("is pitched by the pet's own voice, the same for it every time, and pets' voices apart", () => {
        const ids = Array.from({length: 200}, (_, i) => Math.floor(seeded(i)() * 2 ** 40).toString(36));
        const pitches = ids.map(PetVoiceUtil.getPitch);
        expect(ids.map(PetVoiceUtil.getPitch)).toEqual(pitches);
        expect(Math.min(...pitches)).toBeGreaterThanOrEqual(PET_VOICE_PITCHES[0]);
        expect(Math.max(...pitches)).toBeLessThanOrEqual(PET_VOICE_PITCHES[1]);
        expect(Math.max(...pitches) / Math.min(...pitches)).toBeGreaterThan(Math.sqrt(PET_VOICE_PITCHES[1] / PET_VOICE_PITCHES[0]));
        const at = (pitch: number) => syllablesOf(PetVoiceUtil.compose("x".repeat(30), shows(), pitch, seeded(7)))[0].rate;
        expect(at(1.1) / at(1)).toBeCloseTo(1.1, 6);
    });
});

describe("what a pet feels with no words", () => {
    it("is its battery running down, a start, a fright, a temper or dropping off to sleep, the most sudden first", () => {
        expect(PetVoiceUtil.getFeeling(shows(), shows({powerless: true}))).toBe("powerDown");
        expect(PetVoiceUtil.getFeeling(shows(), shows({expression: E.Surprised}))).toBe("surprise");
        expect(PetVoiceUtil.getFeeling(shows(), shows({action: A.Flee}))).toBe("fright");
        expect(PetVoiceUtil.getFeeling(shows(), shows({action: A.Panic, expression: E.Panicked}))).toBe("fright");
        expect(PetVoiceUtil.getFeeling(shows(), shows({expression: E.Angry}))).toBe("anger");
        expect(PetVoiceUtil.getFeeling(shows(), shows({action: A.Sleep, expression: E.Asleep}))).toBe("sleep");
        expect(PetVoiceUtil.getFeeling(shows(), shows({powerless: true, expression: E.Surprised}))).toBe("powerDown");
        expect(PetVoiceUtil.getFeeling(shows(), shows({action: A.Flee, expression: E.Surprised}))).toBe("surprise");
    });

    it("is nothing new: no mood its words voice, no feeling it still shows, and nothing once it is dead", () => {
        expect(PetVoiceUtil.getFeeling(shows(), shows({expression: E.Happy}))).toBeUndefined();
        expect(PetVoiceUtil.getFeeling(shows(), shows({expression: E.Sad}))).toBeUndefined();
        expect(PetVoiceUtil.getFeeling(shows({expression: E.Angry}), shows({expression: E.Angry, action: A.Attack})))
            .toBeUndefined();
        expect(PetVoiceUtil.getFeeling(shows({action: A.Sleep}), shows({action: A.Sleep}))).toBeUndefined();
        expect(PetVoiceUtil.getFeeling(shows({powerless: true}), shows({powerless: true, expression: E.Sad})))
            .toBeUndefined();
        expect(PetVoiceUtil.getFeeling(shows(), shows({action: A.Dead, expression: E.Off, powerless: true})))
            .toBeUndefined();
    });
});

describe("a pet's voice", () => {
    it("says each line it begins aloud once, from where the pet is, and nothing as its words go", () => {
        const voice = new PetVoice("pet1", "What it came in saying");
        voice.onSaid("What it came in saying", shows(), AT);
        expect(audio.calls).toEqual([]);
        voice.onSaid("Hello!", shows(), AT);
        expect(audio.calls).toHaveLength(1);
        const [said] = audio.calls;
        expect(said.method).toBe("playPhraseAt");
        expect(said.clips.every(clip => CLIPS.syllables.includes(clip as never) || CLIPS.robotSounds.includes(clip as never)))
            .toBe(true);
        expect(said.position).toEqual(AT);
        expect(said.options).toEqual({volume: PET_VOICE_VOLUME, range: PET_VOICE_RANGE});
        voice.onSaid("Hello!", shows(), AT);
        voice.onSaid("", shows(), AT);
        expect(audio.calls).toHaveLength(1);
        voice.onSaid("Hello!", shows(), AT);
        expect(audio.calls).toHaveLength(2);
    });

    it("cuts short what it was saying for a new line, and follows the pet while it speaks", () => {
        const voice = new PetVoice("pet1", "");
        voice.onSaid("One thing.", shows(), AT);
        voice.update(ELSEWHERE, 0);
        expect(audio.calls[0].voice.positions).toEqual([ELSEWHERE]);
        voice.onSaid("Another!", shows(), AT);
        expect(audio.calls[0].voice.stops).toBe(1);
        expect(audio.calls[1].voice.stops).toBe(0);
        voice.stop();
        expect(audio.calls[1].voice.stops).toBe(1);
    });

    it("sounds a feeling a frame later, from where the pet then is, unless a line is said with it", () => {
        const voice = new PetVoice("pet1", "");
        voice.onShown(shows(), shows({expression: E.Surprised}));
        expect(audio.calls).toEqual([]);
        voice.update(ELSEWHERE, 0);
        expect(audio.calls).toHaveLength(1);
        expect(audio.calls[0]).toMatchObject({method: "playAt", clips: ["pet/surprise"], position: ELSEWHERE});
        expect(audio.calls[0].options).toMatchObject({volume: PET_FEELING_VOLUME, range: PET_VOICE_RANGE});

        // A line with it says it instead.
        audio.calls[0].voice.ended = true;
        voice.onShown(shows(), shows({action: A.Panic, expression: E.Panicked}));
        voice.onSaid("Aaah!", shows({action: A.Panic, expression: E.Panicked}), AT);
        voice.update(AT, 1);
        expect(audio.calls.map(call => call.method)).toEqual(["playAt", "playPhraseAt"]);
    });

    it("lets a sudden feeling cut in on its words, and any other go while they still sound", () => {
        const voice = new PetVoice("pet1", "");
        voice.onSaid("A long line it is still saying.", shows(), AT);
        voice.onShown(shows(), shows({expression: E.Angry}));
        voice.update(AT, 0);
        voice.onShown(shows(), shows({action: A.Sleep}));
        voice.update(AT, 1);
        expect(audio.calls).toHaveLength(1);
        voice.onShown(shows(), shows({powerless: true}));
        voice.update(AT, 2);
        expect(audio.calls[0].voice.stops).toBe(1);
        expect(audio.calls[1].clips).toEqual(["pet/powerDown"]);
    });

    it("sounds the same feeling again only after a while, and others meanwhile", () => {
        const voice = new PetVoice("pet1", "");
        const growl = (now: number) => {
            audio.calls.forEach(call => call.voice.ended = true);
            voice.onShown(shows(), shows({expression: E.Angry}));
            voice.update(AT, now);
        };
        growl(0);
        growl(PET_FEELING_REPEAT_MS - 1);
        voice.onShown(shows(), shows({expression: E.Surprised}));
        voice.update(AT, PET_FEELING_REPEAT_MS - 1);
        growl(PET_FEELING_REPEAT_MS);
        expect(audio.calls.map(call => call.clips[0])).toEqual(["pet/growl", "pet/surprise", "pet/growl"]);
    });
});

describe("the clips of a pet's voice", () => {
    it("are each among the game's own sounds, and each made for it is played", () => {
        const made = ProceduralSounds.map(spec => spec.name);
        for (const clip of [...CLIPS.syllables, ...CLIPS.robotSounds, ...CLIPS.feelings])
        {
            expect(made).toContain(clip);
            expect(Object.keys(AudioBundleMap.clips)).toContain(clip);
        }
        expect(new Set(made.filter(name => name.startsWith("pet/voice/"))))
            .toEqual(new Set([...CLIPS.syllables, ...CLIPS.robotSounds]));
    });
});
