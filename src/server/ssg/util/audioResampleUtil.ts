// How many of the windowed sinc's zero crossings it reaches on either side of a sample.
const KERNEL_ZERO_CROSSINGS = 16;
// Where it cuts off, as a share of the lower rate's Nyquist frequency: a little short of it, since a kernel this short
// can't cut sharply.
const CUTOFF = 0.95;

const AudioResampleUtil =
{
    // By a Blackman-windowed sinc, cut off a little short of the lower rate's highest frequency, so that what lies above
    // it doesn't fold back into what is heard. Periodic samples (a loop's) go on from their end into their start, and are
    // stretched by less than a sample to fill a whole number of samples at the new rate; any others have silence on
    // either side.
    resample: (samples: Float32Array, fromRate: number, toRate: number, periodic: boolean = false): Float32Array =>
    {
        if (fromRate == toRate)
            return samples;
        const length = samples.length;
        const resampled = new Float32Array(Math.round(length * toRate / fromRate));
        const step = periodic ? length / resampled.length : fromRate / toRate;
        const cutoff = CUTOFF * Math.min(1, toRate / fromRate);
        const halfWidth = KERNEL_ZERO_CROSSINGS / cutoff;
        for (let i = 0; i < resampled.length; ++i)
        {
            const center = i * step;
            let first = Math.ceil(center - halfWidth);
            let last = Math.floor(center + halfWidth);
            if (!periodic)
            {
                first = Math.max(0, first);
                last = Math.min(length - 1, last);
            }
            let sum = 0;
            for (let k = first; k <= last; ++k)
            {
                const x = k - center;
                sum += samples[((k % length) + length) % length] * cutoff * sinc(cutoff * x) * blackman(x / halfWidth);
            }
            resampled[i] = sum;
        }
        return resampled;
    },
}

function sinc(x: number): number
{
    if (x == 0)
        return 1;
    const angle = Math.PI * x;
    return Math.sin(angle) / angle;
}

// t from -1 to 1.
function blackman(t: number): number
{
    return 0.42 + 0.5 * Math.cos(Math.PI * t) + 0.08 * Math.cos(2 * Math.PI * t);
}

export default AudioResampleUtil;
