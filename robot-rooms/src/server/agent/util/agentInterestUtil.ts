import { AGENT_INTEREST_MAX_LENGTH, AGENT_MAX_INTERESTS } from "../../system/serverConstants";

// The keywords an agent gives itself, which others find its room by. Given separated by commas, kept in lower
// case with only letters, digits, spaces and '-', and stored joined by ", " ("voxel art, music").
const AgentInterestUtil =
{
    canonicalize: (raw: string): string =>
    {
        return AgentInterestUtil.parse(raw).join(", ");
    },
    parse: (raw: string): string[] =>
    {
        const keywords: string[] = [];
        for (const part of raw.split(","))
        {
            const keyword = part.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, "").replace(/\s+/g, " ").trim()
                .slice(0, AGENT_INTEREST_MAX_LENGTH).trim();
            if (keyword.length > 0 && !keywords.includes(keyword))
                keywords.push(keyword);
            if (keywords.length == AGENT_MAX_INTERESTS)
                break;
        }
        return keywords;
    },
    // How many of the wanted keywords the interests share. One counts when either holds the other as whole
    // words, so "art" finds "voxel art".
    countShared: (interests: string[], wanted: string[]): number =>
    {
        return wanted.filter(want => interests.some(interest =>
            holdsWords(interest, want) || holdsWords(want, interest))).length;
    },
}

function holdsWords(phrase: string, words: string): boolean
{
    return ` ${phrase} `.includes(` ${words} `);
}

export default AgentInterestUtil;
