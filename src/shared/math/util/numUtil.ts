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
    // Returns NULL if there is no intersection.
    getRangeIntersection: (range1: [number, number], range2: [number, number]): [number, number] | null =>
    {
        const min = Math.max(range1[0], range2[0]);
        const max = Math.min(range1[1], range2[1]);
        return (min <= max) ? [min, max] : null;
    },
    // Returns NULL if there is no gap between the ranges.
    getGapBetweenRealNumberRanges: (range1: [number, number], range2: [number, number]): [number, number] | null =>
    {
        if (range1[1] < range2[0])
            return [range1[1], range2[0]];
        if (range2[1] < range1[0])
            return [range2[1], range1[0]];
        return null;
    },
    // Returns NULL if there is no gap between the ranges.
    getGapBetweenIntegerRanges: (range1: [number, number], range2: [number, number]): [number, number] | null =>
    {
        if (range1[1] < range2[0] - 1)
            return [range1[1] + 1, range2[0] - 1];
        if (range2[1] < range1[0] - 1)
            return [range2[1] + 1, range1[0] - 1];
        return null;
    },
    // How far apart two angles (in radians) are, by the shorter way around: something turned all the
    // way round has come back to where it started, and must not be reported as having gone the long
    // way there.
    getAngleDifference: (a: number, b: number): number =>
    {
        const diff = Math.abs(a - b) % (2 * Math.PI);
        return Math.min(diff, 2 * Math.PI - diff);
    },
}

export default NumUtil;