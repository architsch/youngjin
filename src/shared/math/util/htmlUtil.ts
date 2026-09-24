import HTMLTag from "../types/htmlTag";

// A tag: an optional closing slash, its name, its attributes (a value quoted, unquoted or left out), and an
// optional self-closing slash.
const TAG_PATTERN =
    /<(\/?)([a-z][a-z0-9]*)((?:\s+[a-z][a-z0-9-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/gi;
const ATTRIBUTE_PATTERN = /([a-z][a-z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi;

// Just enough entities to write a tag's characters as text.
const ENTITY_PATTERN = /&(amp|lt|gt|quot|apos);/g;
const CHAR_BY_ENTITY: {[entity: string]: string} = {amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'"};

// Markup for text the app draws itself; nothing read here is ever handed to the DOM as HTML.
const HTMLUtil =
{
    // The text in order, in runs that each carry the tags enclosing them (outermost first). Only the allowed
    // tags take effect, reading only their allowed attributes; any other tag, and anything malformed, stays
    // in the text as typed. A closing tag also closes the tags opened inside it, and one with nothing open
    // to close is dropped, as browsers do.
    parse: (markup: string, allowedAttributesByTag: {[tagName: string]: readonly string[]})
        : {text: string, tags: HTMLTag[]}[] =>
    {
        const runs: {text: string, tags: HTMLTag[]}[] = [];
        const openTags: HTMLTag[] = [];
        const addText = (rawText: string) => {
            if (rawText.length == 0)
                return;
            const text = decodeEntities(rawText);
            const lastRun = runs[runs.length - 1];
            if (lastRun != undefined && lastRun.tags.length == openTags.length
                && lastRun.tags.every((tag, i) => tag === openTags[i]))
                lastRun.text += text;
            else
                runs.push({text, tags: [...openTags]});
        };

        TAG_PATTERN.lastIndex = 0;
        let textStart = 0;
        let match: RegExpExecArray | null;
        while ((match = TAG_PATTERN.exec(markup)) != null)
        {
            const [tagText, closingSlash, rawName, rawAttributes, selfClosingSlash] = match;
            const name = rawName.toLowerCase();
            const closing = closingSlash.length > 0;
            // Own properties only, so that a name like "constructor" can't pass for an allowed one.
            if (!Object.prototype.hasOwnProperty.call(allowedAttributesByTag, name)
                || (closing && (rawAttributes.trim().length > 0 || selfClosingSlash.length > 0)))
                continue;

            addText(markup.substring(textStart, match.index));
            textStart = match.index + tagText.length;
            if (closing)
            {
                const index = openTags.map(tag => tag.name).lastIndexOf(name);
                if (index >= 0)
                    openTags.length = index;
            }
            else if (selfClosingSlash.length == 0)
            {
                openTags.push({name, attributes: readAttributes(rawAttributes, allowedAttributesByTag[name])});
            }
        }
        addText(markup.substring(textStart));
        return runs;
    },
}

// The first of each allowed attribute wins, as in browsers.
function readAttributes(rawAttributes: string, allowedNames: readonly string[]): {[name: string]: string}
{
    const attributes: {[name: string]: string} = {};
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ATTRIBUTE_PATTERN.exec(rawAttributes)) != null)
    {
        const name = match[1].toLowerCase();
        if (allowedNames.includes(name) && attributes[name] == undefined)
            attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    }
    return attributes;
}

function decodeEntities(text: string): string
{
    return text.replace(ENTITY_PATTERN, (_, entity: string) => CHAR_BY_ENTITY[entity]);
}

export default HTMLUtil;
