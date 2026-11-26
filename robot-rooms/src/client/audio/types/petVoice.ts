import Vec3 from "../../../shared/math/types/vec3";
import PetShownState from "../../../shared/object/types/petShownState";
import AudioManager from "../audioManager";
import PetVoiceUtil, { PET_FEELING_VOLUME, PET_VOICE_RANGE, PET_VOICE_VOLUME } from "../util/petVoiceUtil";
import PetFeeling from "./petFeeling";
import SpatialAudioVoice from "./spatialAudioVoice";

// How soon a pet sounds the same feeling again at the earliest, in milliseconds, so that a face flickering between two
// moods doesn't growl over and over.
export const PET_FEELING_REPEAT_MS = 15_000;

// A pet's voice (see PetVoiceUtil), which its game object keeps: one sound at a time, heard from where the pet is. A
// line cuts short whatever it was saying. A feeling shown with no words waits a frame, so that a line said with it
// voices it instead; then, unless sudden, it is let go while the voice still sounds.
export default class PetVoice
{
    private readonly pitch: number;
    private sound: SpatialAudioVoice | undefined;
    private said: string;
    private unvoiced: PetFeeling | undefined;
    private readonly voicedAt: Map<PetFeeling, number> = new Map();

    // said: what the pet says as it comes into the room.
    constructor(objectId: string, said: string)
    {
        this.pitch = PetVoiceUtil.getPitch(objectId);
        this.said = said;
    }

    // What the pet says has changed: a line it has just begun is said aloud, as what it shows has it.
    onSaid(text: string, shown: PetShownState, position: Vec3): void
    {
        const before = this.said;
        this.said = text;
        if (text.length > 0 && text != before)
            this.babble(text, shown, position);
    }

    babble(text: string, shown: PetShownState, position: Vec3): void
    {
        this.unvoiced = undefined;
        this.sound?.stop();
        this.sound = AudioManager.playPhraseAt(PetVoiceUtil.compose(text, shown, this.pitch), position,
            {volume: PET_VOICE_VOLUME, range: PET_VOICE_RANGE});
    }

    onShown(before: PetShownState, after: PetShownState): void
    {
        this.unvoiced = PetVoiceUtil.getFeeling(before, after) ?? this.unvoiced;
    }

    // Every frame.
    update(position: Vec3, now: number): void
    {
        if (this.sound?.isEnded())
            this.sound = undefined;
        const feeling = this.unvoiced;
        this.unvoiced = undefined;
        if (feeling != undefined && now - (this.voicedAt.get(feeling) ?? -Infinity) >= PET_FEELING_REPEAT_MS
            && (this.sound == undefined || PetVoiceUtil.isSudden(feeling)))
        {
            this.voicedAt.set(feeling, now);
            this.sound?.stop();
            this.sound = AudioManager.playAt(PetVoiceUtil.getFeelingClip(feeling), position,
                {volume: PET_FEELING_VOLUME, range: PET_VOICE_RANGE, rate: Math.sqrt(this.pitch)});
        }
        this.sound?.setPosition(position);
    }

    stop(): void
    {
        this.sound?.stop();
        this.sound = undefined;
        this.unvoiced = undefined;
    }
}
