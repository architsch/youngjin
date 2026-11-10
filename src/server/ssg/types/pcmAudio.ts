// A sound's samples, one array per channel, from -1 to 1.
export default interface PcmAudio
{
    sampleRate: number;
    channels: Float32Array[];
}
