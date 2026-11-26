import AudioClipName from "./audioClipName";

// One clip of a phrase (see AudioManager.playPhraseAt): when it starts, in seconds after the phrase does, how fast it
// plays (which raises its pitch as much), and how loud, over the phrase's own volume.
export default interface AudioPhrasePart
{
    clip: AudioClipName;
    at: number;
    rate: number;
    volume: number;
}
