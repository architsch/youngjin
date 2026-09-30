// Numbers as the controls show and step them.
const NumberUtil =
{
    getDecimals: (step: number): number =>
    {
        const text = String(step);
        const dot = text.indexOf(".");
        return (dot < 0) ? 0 : text.length - dot - 1;
    },
    round: (value: number, decimals: number): number =>
    {
        return Number(value.toFixed(decimals));
    },
    clamp: (value: number, min: number, max: number): number =>
    {
        return Math.min(max, Math.max(min, value));
    },
    // Without arithmetic's float noise (0.30000000000000004).
    format: (value: number): string =>
    {
        return Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
    },
}

export default NumberUtil;
