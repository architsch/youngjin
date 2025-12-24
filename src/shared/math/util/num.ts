const Num =
{
    normalizeInRange: (n: number, min: number, max: number): number =>
    {
        return (Num.clampInRange(n, min, max) - min) / (max - min);
    },
    clampInRange: (n: number, min: number, max: number): number =>
    {
        if (n < min || n > max)
            console.error(`'n' is out of its expected range (n = ${n}, min = ${min}, max = ${max})`);
        return Math.max(min, Math.min(max, n));
    },
    numberIsInRange: (num: number, range_min: number, range_max: number,
        comparisonIsExclusive: boolean = false
    ): boolean =>
    {
        if (comparisonIsExclusive)
            return num > range_min && num < range_max;
        else
            return num >= range_min && num <= range_max;
    },
    rangesOverlap: (range1_min: number, range1_max: number, range2_min: number, range2_max: number,
        comparisonIsExclusive: boolean = false
    ): boolean =>
    {
        if (comparisonIsExclusive)
            return range1_min < range2_max && range2_min < range1_max;
        else
            return range1_min <= range2_max && range2_min <= range1_max;
    },
}

export default Num;