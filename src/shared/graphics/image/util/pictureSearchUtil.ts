import { PICTURE_SEARCH_FILLER_WORDS } from "../../../system/sharedConstants";

// The one way pictures are searched, in the game's choosers (see ImageChoiceUtil) and the image map editor alike.
const PictureSearchUtil =
{
    // The items whose words hold every word typed, anywhere in them and case aside (so "red crate" finds
    // "crate,red,pepper"), but for filler words ("and", "of"), which keywords leave out; all of them when nothing else
    // is typed.
    filter: <T>(items: T[], searchInput: string, getWords: (item: T) => string): T[] =>
    {
        const terms = searchInput.toLowerCase().split(/[\s,]+/)
            .filter(term => term.length > 0 && !PICTURE_SEARCH_FILLER_WORDS.includes(term));
        if (terms.length === 0)
            return items;
        return items.filter(item => {
            const words = getWords(item).toLowerCase();
            return terms.every(term => isFound(words, term));
        });
    },
}

// As typed, or as its singular, since keywords are singular ("peppers", "boxes"); too short a word is left as is,
// or it would find far too much.
function isFound(words: string, term: string): boolean
{
    if (words.includes(term))
        return true;
    if (term.length <= 3 || !term.endsWith("s"))
        return false;
    return words.includes(term.slice(0, -1)) || (term.endsWith("es") && words.includes(term.slice(0, -2)));
}

export default PictureSearchUtil;
