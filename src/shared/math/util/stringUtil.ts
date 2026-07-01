const StringUtil =
{
    // Truncates by Unicode code points rather than UTF-16 code units, so multi-unit
    // characters (e.g. emojis represented as surrogate pairs) are never split mid-character.
    truncateByCodePoints: (str: string, maxCodePoints: number): string =>
    {
        const codePoints = Array.from(str);
        if (codePoints.length <= maxCodePoints)
            return str;
        return codePoints.slice(0, maxCodePoints).join("");
    },

    // "Visible ASCII Range" = Range of UTF-8/UTF-16 char codes covering only the visible ASCII characters such as alphanumerics and symbols (no blank spaces).
    // There are 94 characters within the Visible ASCII Range [33,126] (inclusive)
    // 33 = UTF-16/UTF-8 char code of the exclamation mark (!)
    // 126 = UTF-16/UTF-8 char code of tilde (~)
    convertVisibleASCIIToNumber: (str: string, charIndex: number,
        min: number, max: number): number =>
    {
        const raw = (0 < str.length) ? str.charCodeAt(charIndex)-33 : 0; // = [0,93]
        const normalized = raw * 0.0107; // = [0,1)
        return min + (max - min) * normalized;
    },
    convertNumberToVisibleASCII: (n: number, min: number, max: number): string =>
    {
        const normalized = (n - min) / (max - min); // = [0,1)
        const raw = Math.floor(normalized * 93.4579); // = [0,93]
        return String.fromCharCode(raw + 33);
    },
    getVisibleASCIIByIndex: (index: number): string =>
    {
        return String.fromCharCode(33 + index);
    },
}

export default StringUtil;
