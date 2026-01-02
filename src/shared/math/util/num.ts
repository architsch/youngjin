const Num =
{
    normalizeInRange: (n: number, min: number, max: number): number =>
    {
        return (Num.clampInRange(n, min, max) - min) / (max - min);
    },
    clampInRange: (n: number, min: number, max: number): number =>
    {
        return Math.max(min, Math.min(max, n));
    },
    normalizeInRangeWithWarning: (n: number, min: number, max: number): number =>
    {
        return (Num.clampInRangeWithWarning(n, min, max) - min) / (max - min);
    },
    clampInRangeWithWarning: (n: number, min: number, max: number): number =>
    {
        if (n < min || n > max)
            console.warn(`'n' is out of its expected range (n = ${n}, min = ${min}, max = ${max})`);
        return Math.max(min, Math.min(max, n));
    },
}

export default Num;