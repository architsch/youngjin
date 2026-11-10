import PcmAudio from "../types/pcmAudio";

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_IEEE_FLOAT = 3;
const WAVE_FORMAT_EXTENSIBLE = 0xFFFE;

const WavFileUtil =
{
    // Integer samples of 8 to 32 bits, or floats of 32 or 64, under either header (the plain one or the extensible
    // one). Throws, saying why, on anything else.
    decode: (bytes: Buffer): PcmAudio =>
    {
        if (bytes.length < 12 || bytes.toString("ascii", 0, 4) != "RIFF" || bytes.toString("ascii", 8, 12) != "WAVE")
            throw new Error("it isn't a WAV file");
        let format: {code: number, numChannels: number, sampleRate: number, blockAlign: number,
            bitsPerSample: number} | undefined;
        let data: Buffer | undefined;
        for (let offset = 12; offset + 8 <= bytes.length;)
        {
            const id = bytes.toString("ascii", offset, offset + 4);
            const size = bytes.readUInt32LE(offset + 4);
            const body = bytes.subarray(offset + 8, Math.min(bytes.length, offset + 8 + size));
            if (id == "fmt " && body.length >= 16)
            {
                const code = body.readUInt16LE(0);
                format = {
                    // An extensible header gives the real format as the first two bytes of its sub-format GUID.
                    code: (code == WAVE_FORMAT_EXTENSIBLE && body.length >= 26) ? body.readUInt16LE(24) : code,
                    numChannels: body.readUInt16LE(2),
                    sampleRate: body.readUInt32LE(4),
                    blockAlign: body.readUInt16LE(12),
                    bitsPerSample: body.readUInt16LE(14),
                };
            }
            else if (id == "data")
                data = body;
            // A chunk of odd size is followed by a byte of padding.
            offset += 8 + size + (size % 2);
        }
        if (format == undefined)
            throw new Error("it has no format chunk");
        if (data == undefined)
            throw new Error("it has no data chunk");

        const {code, numChannels, sampleRate, blockAlign, bitsPerSample} = format;
        const readSample = getSampleReader(code, bitsPerSample);
        if (readSample == undefined)
            throw new Error(`its samples are of a kind this can't read (format = ${code}, bits = ${bitsPerSample})`);
        const bytesPerSample = bitsPerSample / 8;
        if (numChannels == 0 || sampleRate == 0 || blockAlign < numChannels * bytesPerSample)
            throw new Error(`its format chunk is broken (channels = ${numChannels}, rate = ${sampleRate}, block = ${blockAlign})`);

        const numFrames = Math.floor(data.length / blockAlign);
        const channels: Float32Array[] = [];
        for (let c = 0; c < numChannels; ++c)
        {
            const samples = new Float32Array(numFrames);
            for (let i = 0; i < numFrames; ++i)
                samples[i] = readSample(data, i * blockAlign + c * bytesPerSample);
            channels.push(samples);
        }
        return {sampleRate, channels};
    },
}

function getSampleReader(code: number, bitsPerSample: number): ((data: Buffer, offset: number) => number) | undefined
{
    if (code == WAVE_FORMAT_PCM)
    {
        switch (bitsPerSample)
        {
            case 8: return (data, offset) => (data.readUInt8(offset) - 128) / 128; // the one unsigned width
            case 16: return (data, offset) => data.readInt16LE(offset) / 32768;
            case 24: return (data, offset) => data.readIntLE(offset, 3) / 8388608;
            case 32: return (data, offset) => data.readInt32LE(offset) / 2147483648;
        }
    }
    else if (code == WAVE_FORMAT_IEEE_FLOAT)
    {
        switch (bitsPerSample)
        {
            case 32: return (data, offset) => data.readFloatLE(offset);
            case 64: return (data, offset) => data.readDoubleLE(offset);
        }
    }
    return undefined;
}

export default WavFileUtil;
