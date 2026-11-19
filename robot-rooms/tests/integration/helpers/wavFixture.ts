/**
 * WAV files written from samples, for suites that feed the audio bundle builder: integer samples of 8 to 32 bits or
 * floats of 32 or 64, under the plain header or the extensible one.
 */
export function writeWav(channels: Float32Array[], sampleRate: number,
    options?: {bits?: number, float?: boolean, extensible?: boolean}): Buffer
{
    const bits = options?.bits ?? 16;
    const float = options?.float ?? false;
    const extensible = options?.extensible ?? false;
    const numChannels = channels.length;
    const numFrames = channels[0].length;
    const bytesPerSample = bits / 8;
    const blockAlign = numChannels * bytesPerSample;
    const fmtSize = extensible ? 40 : 16;
    const dataOffset = 12 + 8 + fmtSize;
    const bytes = Buffer.alloc(dataOffset + 8 + numFrames * blockAlign);
    const code = float ? 3 : 1;

    bytes.write("RIFF", 0);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write("WAVE", 8);
    bytes.write("fmt ", 12);
    bytes.writeUInt32LE(fmtSize, 16);
    bytes.writeUInt16LE(extensible ? 0xFFFE : code, 20);
    bytes.writeUInt16LE(numChannels, 22);
    bytes.writeUInt32LE(sampleRate, 24);
    bytes.writeUInt32LE(sampleRate * blockAlign, 28);
    bytes.writeUInt16LE(blockAlign, 32);
    bytes.writeUInt16LE(bits, 34);
    if (extensible)
    {
        bytes.writeUInt16LE(22, 36); // the extension's size
        bytes.writeUInt16LE(bits, 38); // valid bits
        bytes.writeUInt32LE(0, 40); // channel mask
        bytes.writeUInt16LE(code, 44); // the sub-format GUID's first two bytes
    }
    bytes.write("data", dataOffset);
    bytes.writeUInt32LE(numFrames * blockAlign, dataOffset + 4);

    let offset = dataOffset + 8;
    for (let i = 0; i < numFrames; ++i)
    {
        for (let c = 0; c < numChannels; ++c, offset += bytesPerSample)
        {
            const value = Math.max(-1, Math.min(1, channels[c][i]));
            if (float)
                (bits == 32) ? bytes.writeFloatLE(value, offset) : bytes.writeDoubleLE(value, offset);
            else if (bits == 8)
                bytes.writeUInt8(Math.round(value * 127) + 128, offset);
            else if (bits == 16)
                bytes.writeInt16LE(Math.round(value * 32767), offset);
            else if (bits == 24)
                bytes.writeIntLE(Math.round(value * 8388607), offset, 3);
            else
                bytes.writeInt32LE(Math.round(value * 2147483647), offset);
        }
    }
    return bytes;
}

/** A WAV file around interleaved 16-bit little-endian samples, as the audio bundle builder hands them to its encoder. */
export function wrapPcm16(pcm: Buffer, numChannels: number, sampleRate: number): Buffer
{
    const header = writeWav(Array.from({length: numChannels}, () => new Float32Array(0)), sampleRate);
    header.writeUInt32LE(header.length - 8 + pcm.length, 4);
    header.writeUInt32LE(pcm.length, header.length - 4);
    return Buffer.concat([header, pcm]);
}

/** A sine of the given frequency and amplitude, seconds long. */
export function sine(seconds: number, sampleRate: number, frequency: number, amplitude: number, phase: number = 0): Float32Array
{
    const samples = new Float32Array(Math.round(seconds * sampleRate));
    for (let i = 0; i < samples.length; ++i)
        samples[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate + phase);
    return samples;
}

/** Noise from a seeded generator, so a clip is the same on every run. */
export function noise(numSamples: number, amplitude: number, seed: number): Float32Array
{
    const samples = new Float32Array(numSamples);
    let state = seed >>> 0;
    for (let i = 0; i < numSamples; ++i)
    {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        samples[i] = amplitude * (state / 4294967296 * 2 - 1);
    }
    return samples;
}
