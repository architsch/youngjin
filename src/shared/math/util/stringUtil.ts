import NumUtil from "./numUtil";

const StringUtil =
{
    // Counts code points, so surrogate pairs (e.g. emoji) are never split.
    truncateByCodePoints: (str: string, maxCodePoints: number): string =>
    {
        const codePoints = Array.from(str);
        if (codePoints.length <= maxCodePoints)
            return str;
        return codePoints.slice(0, maxCodePoints).join("");
    },

    // A polynomial rolling hash that fits in a few lines and returns a 32-bit integer (signed).
    getHashCode: (str: string): number =>
    {
        let hash = 0;
        for (let i = 0; i < str.length; ++i)
            hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
        return hash;
    },

    // Lossy, fixed-width, quantized base-94 encoding into visible ASCII [33 '!', 126 '~'], for storing
    // arbitrary data (e.g. object metadata) as printable strings.
    convertVisibleASCIIToNumber: (str: string, charIndex: number,
        min: number, max: number, fallbackRawNumber: number = 0): number =>
    {
        const raw = StringUtil.convertVisibleASCIIToRawNumber(str, charIndex, fallbackRawNumber);
        return NumUtil.convertRange(raw, 0, 93, min, max, true);
    },
    convertNumberToVisibleASCII: (n: number, min: number, max: number): string =>
    {
        const raw = Math.round(NumUtil.convertRange(n, min, max, 0, 93, true));
        return StringUtil.convertRawNumberToVisibleASCII(raw);
    },
    convertVisibleASCIIToRawNumber: (str: string, charIndex: number,
        fallbackRawNumber: number = 0): number =>
    {
        if (charIndex >= str.length)
            return fallbackRawNumber;
        return NumUtil.clampInRange(str.charCodeAt(charIndex)-33, 0, 93); // = [0,93]
    },
    convertRawNumberToVisibleASCII: (raw: number): string =>
    {
        return String.fromCharCode(33 + raw);
    },
}

export default StringUtil;
