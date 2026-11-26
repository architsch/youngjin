import StringUtil from "../../../shared/math/util/stringUtil";
import { PetActionEnumMap } from "../../../shared/object/types/petAction";
import { PetExpressionEnumMap } from "../../../shared/object/types/petExpression";
import PetShownState from "../../../shared/object/types/petShownState";
import { PetSpeechToneEnumMap } from "../../../shared/object/types/petSpeechTone";
import MessageLinkUtil from "../../../shared/object/util/messageLinkUtil";
import AudioBundleMap from "../maps/audioBundleMap";
import AudioClipName from "../types/audioClipName";
import AudioPhrasePart from "../types/audioPhrasePart";
import PetFeeling from "../types/petFeeling";

// How loud a pet's voice is, saying a line and showing a feeling, and how far it carries, in world units: softer and
// nearer than what befalls a pet (see PET_SOUND_RANGE), since pets talk often.
export const PET_VOICE_VOLUME = 0.5;
export const PET_FEELING_VOLUME = 0.6;
export const PET_VOICE_RANGE = 12;
// The lowest and the highest a pet's own voice is pitched, over the pitch its syllables are made at.
export const PET_VOICE_PITCHES = [0.86, 1.18];
// A line's babble has a syllable for about so many of its characters, one more or less, and within these.
export const PET_CHARS_PER_SYLLABLE = 5.5;
export const PET_BABBLE_SYLLABLES = [2, 10];
// A syllable's length at its own pitch, onset to onset, and the breaks after it, within a word and between words, at a
// calm pace; in seconds. A word is one to three syllables long, by these shares.
const SYLLABLE_SECONDS = 0.1;
const SYLLABLE_GAP_SECONDS = [0.005, 0.03];
const WORD_GAP_SECONDS = [0.06, 0.11];
const WORD_SHARES = [0.3, 0.45, 0.25];
// In semitones: how much higher a word's first syllable is, and a question's last syllable and the one before it, and
// an exclamation's last.
const WORD_ACCENT = 0.7;
const QUESTION_RISE = [1, 4];
const EXCLAMATION_RISE = 2;
// How loud a syllable is: a word's first in full, the others a little less, and a line's last quieter, unless exclaimed.
const SYLLABLE_VOLUMES = [0.85, 1];
const LAST_SYLLABLE_VOLUME = 0.85;
// A robot's sound in a babble: at its start, at its end, or else between two words, by these shares; its pitch, about
// its voice's, straying so many semitones either way; its loudness; and the break on either side.
const ROBOT_SOUND_PLACES = [0.35, 0.45];
const ROBOT_SOUND_SPREAD = 1;
const ROBOT_SOUND_VOLUME = 0.9;
const ROBOT_SOUND_GAP_SECONDS = 0.03;
// Excited (hopping), it speaks this much faster, and higher.
const EXCITED_TEMPO = 1.15;
const EXCITED_PITCH = 1.06;
// Asking for a battery, it opens with the notes of a toy switched off and runs down as it speaks: its last syllable
// this much lower and slower than its first, and quieter by this share.
const RUN_DOWN_PITCH = 0.65;
const RUN_DOWN_FADE = 0.3;
const POWER_DOWN: AudioClipName = "pet/powerDown";

const BEEP: AudioClipName = "pet/voice/beep";
const BOOP: AudioClipName = "pet/voice/boop";
const BIP: AudioClipName = "pet/voice/bip";
const BWEEP: AudioClipName = "pet/voice/bweep";
const BLOOP: AudioClipName = "pet/voice/bloop";
// The syllables a pet babbles in (see ProceduralSounds), each with its vowel.
const SYLLABLES: [AudioClipName, string][] = [["pet/voice/ba", "a"], ["pet/voice/bo", "o"], ["pet/voice/di", "i"],
    ["pet/voice/du", "u"], ["pet/voice/ge", "e"], ["pet/voice/ka", "a"], ["pet/voice/ki", "i"], ["pet/voice/mo", "o"],
    ["pet/voice/na", "a"], ["pet/voice/ti", "i"], ["pet/voice/wa", "a"], ["pet/voice/yu", "u"]];

const E = PetExpressionEnumMap;
// How the face a line is said with colors its babble: its pitch and pace (over the voice's own), its loudness, how far
// each syllable strays from the tune (semitones, either way), how far the tune falls or rises over the line, how much
// its syllables bounce up and down in turn, the vowels it favors, how often a robot's sound comes among them, and which.
const MOODS: {[expression: number]: {pitch: number, tempo: number, volume: number, spread: number, drift: number,
    bounce: number, vowels: string, robotChance: number, robotSounds: AudioClipName[]}} = {
    [E.Neutral]: {pitch: 1, tempo: 1, volume: 1, spread: 1.5, drift: -2, bounce: 0, vowels: "aeiou", robotChance: 0.35,
        robotSounds: [BEEP, BOOP, BIP, BWEEP, BLOOP]},
    [E.Happy]: {pitch: 1.12, tempo: 1.1, volume: 1, spread: 1.5, drift: 1, bounce: 2, vowels: "aaei", robotChance: 0.5,
        robotSounds: [BEEP, BIP, BWEEP]},
    [E.Sad]: {pitch: 0.86, tempo: 0.8, volume: 0.8, spread: 1, drift: -4, bounce: 0, vowels: "oouu", robotChance: 0.3,
        robotSounds: [BOOP, BLOOP]},
    [E.Surprised]: {pitch: 1.15, tempo: 1.05, volume: 1, spread: 2, drift: 2, bounce: 0, vowels: "oaei", robotChance: 0.35,
        robotSounds: [BWEEP, BIP]},
    [E.Angry]: {pitch: 0.84, tempo: 1.15, volume: 1.1, spread: 1, drift: -1, bounce: 0, vowels: "aaoou", robotChance: 0.1,
        robotSounds: [BOOP]},
    [E.Panicked]: {pitch: 1.3, tempo: 1.35, volume: 1, spread: 1, drift: 0, bounce: 3, vowels: "iiee", robotChance: 0.4,
        robotSounds: [BIP, BEEP]},
};
// Asking for a wrench: slow, low and faint, falling away.
const DYING_MOOD = {...MOODS[E.Sad], pitch: 0.82, tempo: 0.7, volume: 0.75, drift: -5};
// What each feeling sounds as.
const FEELING_CLIPS: {[feeling in PetFeeling]: AudioClipName} = {
    surprise: "pet/surprise",
    anger: "pet/growl",
    fright: "pet/yelp",
    sleep: "pet/yawn",
    powerDown: POWER_DOWN,
};

// How a pet sounds (see PetVoice): each line it says aloud, as a babble of syllables in a robot's voice, now and then
// with a beep or a boop among them, its tune by the face it says it with; and each feeling it shows with no words. Its
// voice's pitch is its own, the same in every browser, and each babble is drawn afresh.
const PetVoiceUtil =
{
    getPitch: (objectId: string): number =>
    {
        const share = (((StringUtil.getHashCode(objectId) % 1000) + 1000) % 1000) / 999;
        return PET_VOICE_PITCHES[0] * (PET_VOICE_PITCHES[1] / PET_VOICE_PITCHES[0]) ** share;
    },
    // A line's babble, by what the pet shows as it says it: its face, whether it is excited, and what its words ask for.
    compose: (text: string, shown: PetShownState, pitch: number, random: () => number = Math.random): AudioPhrasePart[] =>
    {
        const runsDown = shown.tone == PetSpeechToneEnumMap.Powerless;
        const mood = (shown.tone == PetSpeechToneEnumMap.Dying) ? DYING_MOOD : runsDown ? MOODS[E.Sad]
            : MOODS[shown.expression] ?? MOODS[E.Neutral];
        const tempo = mood.tempo * (shown.excited ? EXCITED_TEMPO : 1);
        const tune = pitch * mood.pitch * (shown.excited ? EXCITED_PITCH : 1);
        const ending = getEnding(text);
        const count = Math.max(PET_BABBLE_SYLLABLES[0], Math.min(PET_BABBLE_SYLLABLES[1],
            Math.round(MessageLinkUtil.getVisibleLength(text) / PET_CHARS_PER_SYLLABLE) + Math.floor(3 * random()) - 1));
        const words = splitIntoWords(count, random);
        const robotSound = runsDown ? POWER_DOWN
            : (random() < mood.robotChance) ? pickOne(mood.robotSounds, random) : undefined;
        // After which word it comes: -1 for before the first.
        const placeDraw = random();
        const robotSoundAfter = (runsDown || placeDraw < ROBOT_SOUND_PLACES[0]) ? -1
            : (placeDraw < ROBOT_SOUND_PLACES[0] + ROBOT_SOUND_PLACES[1] || words.length < 2) ? words.length - 1
            : Math.floor(random() * (words.length - 1));

        const parts: AudioPhrasePart[] = [];
        let at = 0;
        const addRobotSound = (clip: AudioClipName) =>
        {
            const rate = Math.sqrt(pitch) * 2 ** (ROBOT_SOUND_SPREAD * (2 * random() - 1) / 12);
            at += (at > 0) ? ROBOT_SOUND_GAP_SECONDS : 0;
            parts.push({clip, at, rate, volume: ROBOT_SOUND_VOLUME});
            at += AudioBundleMap.clips[clip as keyof typeof AudioBundleMap.clips].duration / rate
                + ROBOT_SOUND_GAP_SECONDS;
        };
        if (robotSound != undefined && robotSoundAfter == -1)
            addRobotSound(robotSound);
        let previous: AudioClipName | undefined = undefined;
        let i = 0;
        words.forEach((length, word) => {
            if (word > 0)
                at += between(WORD_GAP_SECONDS, random) / tempo;
            for (let k = 0; k < length; ++k, ++i)
            {
                const share = (count == 1) ? 0 : i / (count - 1);
                const last = i == count - 1;
                const semitones = mood.drift * share + mood.spread * (2 * random() - 1)
                    + ((i % 2 == 0) ? 0.5 : -0.5) * mood.bounce + ((k == 0) ? WORD_ACCENT : 0)
                    + ((ending == "?") ? (last ? QUESTION_RISE[1] : (i == count - 2) ? QUESTION_RISE[0] : 0)
                    : (ending == "!" && last) ? EXCLAMATION_RISE : 0);
                const rate = tune * 2 ** (semitones / 12) * (runsDown ? RUN_DOWN_PITCH ** share : 1);
                const clip = pickSyllable(mood.vowels, previous, random);
                previous = clip;
                const volume = (last && ending != "!") ? LAST_SYLLABLE_VOLUME : (k == 0) ? 1 : between(SYLLABLE_VOLUMES, random);
                parts.push({clip, at, rate, volume: volume * mood.volume * (runsDown ? 1 - RUN_DOWN_FADE * share : 1)});
                at += SYLLABLE_SECONDS / rate + between(SYLLABLE_GAP_SECONDS, random) / tempo;
            }
            if (robotSound != undefined && robotSoundAfter == word)
                addRobotSound(robotSound);
        });
        return parts;
    },
    // What a change in what a pet shows sounds as, with no words: its battery running down, a start, a fright, a temper,
    // or dropping off to sleep; undefined for any other, which the words it says with it, if any, voice.
    getFeeling: (before: PetShownState, after: PetShownState): PetFeeling | undefined =>
    {
        const A = PetActionEnumMap;
        if (after.action == A.Dead)
            return undefined;
        if (after.powerless && !before.powerless)
            return "powerDown";
        if (after.expression == E.Surprised && before.expression != E.Surprised)
            return "surprise";
        if ((after.action == A.Flee || after.action == A.Panic) && after.action != before.action)
            return "fright";
        if (after.expression == E.Angry && before.expression != E.Angry)
            return "anger";
        if (after.action == A.Sleep && before.action != A.Sleep)
            return "sleep";
        return undefined;
    },
    getFeelingClip: (feeling: PetFeeling): AudioClipName =>
    {
        return FEELING_CLIPS[feeling];
    },
    // Whether a feeling cuts in on whatever the pet's voice is still saying; any other waits for nothing, and is let go.
    isSudden: (feeling: PetFeeling): boolean =>
    {
        return feeling == "surprise" || feeling == "fright" || feeling == "powerDown";
    },
    // Every clip a pet's voice plays, by what it is (for what checks them).
    getClips: (): {syllables: AudioClipName[], robotSounds: AudioClipName[], feelings: AudioClipName[]} =>
    {
        return {syllables: SYLLABLES.map(([clip]) => clip), robotSounds: [BEEP, BOOP, BIP, BWEEP, BLOOP],
            feelings: Object.values(FEELING_CLIPS)};
    },
}

// The way a line ends, for the tune its last syllables take: as a question, an exclamation, or neither.
function getEnding(text: string): "?" | "!" | ""
{
    const shown = MessageLinkUtil.getVisibleText(MessageLinkUtil.parse(text));
    const mark = /[?!.](?=[^?!.\p{L}\p{N}]*$)/u.exec(shown)?.[0];
    return (mark == "?" || mark == "!") ? mark : "";
}

// How many syllables each word of a babble has, all of them adding up to count.
function splitIntoWords(count: number, random: () => number): number[]
{
    const words: number[] = [];
    for (let left = count; left > 0;)
    {
        const draw = random();
        const length = Math.min(left, (draw < WORD_SHARES[0]) ? 1 : (draw < WORD_SHARES[0] + WORD_SHARES[1]) ? 2 : 3);
        words.push(length);
        left -= length;
    }
    return words;
}

// A syllable other than the last one, those with the vowels a mood favors the likelier, once for each time it lists one.
function pickSyllable(vowels: string, previous: AudioClipName | undefined, random: () => number): AudioClipName
{
    const weights = SYLLABLES.map(([clip, vowel]) => (clip == previous) ? 0
        : 1 + [...vowels].filter(favored => favored == vowel).length);
    let draw = random() * weights.reduce((sum, weight) => sum + weight, 0);
    for (let i = 0; i < SYLLABLES.length; ++i)
    {
        draw -= weights[i];
        if (draw < 0 && weights[i] > 0)
            return SYLLABLES[i][0];
    }
    return SYLLABLES.find(([clip]) => clip != previous)![0];
}

function pickOne<T>(items: T[], random: () => number): T
{
    return items[Math.floor(random() * items.length)];
}

function between([min, max]: number[], random: () => number): number
{
    return min + random() * (max - min);
}

export default PetVoiceUtil;
