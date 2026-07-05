import NumUtil from "./numUtil";

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

    //------------------------------------------------------------------------
    // NOTE: The purpose of the following methods is to be able to encode
    // arbitrary data as a string of printable characters (e.g. a GameObject's metadata),
    // so as to safely store it in the DB's string data field.
    // I am using a base-94 & fixed-width & quantized encoding scheme here, which is lossy.
    //------------------------------------------------------------------------
    // "Visible ASCII Range" = Range of UTF-8/UTF-16 char codes covering only the visible ASCII characters such as alphanumerics and symbols (no blank spaces).
    // There are 94 characters within the Visible ASCII Range [33,126] (inclusive)
    // 33 = UTF-16/UTF-8 char code of the exclamation mark (!)
    // 126 = UTF-16/UTF-8 char code of tilde (~)
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
        return (charIndex < str.length)
            ? str.charCodeAt(charIndex)-33
            : fallbackRawNumber; // = [0,93]
    },
    convertRawNumberToVisibleASCII: (raw: number): string =>
    {
        return String.fromCharCode(33 + raw);
    },
}

export default StringUtil;
