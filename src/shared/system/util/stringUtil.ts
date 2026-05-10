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
}

export default StringUtil;
