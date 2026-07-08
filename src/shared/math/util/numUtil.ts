const NumUtil =
{
    convertRange: (n: number, fromMin: number, fromMax: number,
        toMin: number, toMax: number, withWarning: boolean = false): number =>
    {
        const normalized = NumUtil.normalizeInRange(n, fromMin, fromMax, withWarning);
        return toMin + normalized * (toMax - toMin);
    },
    normalizeInRange: (n: number, min: number, max: number, withWarning: boolean = false): number =>
    {
        return (NumUtil.clampInRange(n, min, max, withWarning) - min)
            / (max - min);
    },
    clampInRange: (n: number, min: number, max: number, withWarning: boolean = false): number =>
    {
        if (withWarning && (n < min || n > max))
            console.warn(`'n' is out of its expected range (n = ${n}, min = ${min}, max = ${max})`);
        return Math.max(min, Math.min(max, n));
    },
}

export default NumUtil;