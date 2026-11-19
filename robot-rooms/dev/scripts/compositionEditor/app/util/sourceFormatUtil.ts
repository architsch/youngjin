import PreEncodingSource from "../types/preEncodingSource";

// Writes the source in the layout it is kept in by hand, so a save changes only the lines that were edited:
// a value goes on one line when it fits, and a container whose only member is an object that doesn't fit
// opens on the same line as it (`"parts": [{`, `"params": {"colors": {`). The file, the list and each entry
// are always spread out.
const INDENT = "    ";
const MAX_LINE_WIDTH = 120;
const MIN_COMPACT_DEPTH = 3;

const SourceFormatUtil =
{
    format: (source: PreEncodingSource): string =>
    {
        return formatValue(source, 0, 0, 0);
    },
}

export default SourceFormatUtil;

// usedWidth: what precedes the value on its first line; trailingWidth: what follows it on its last.
function formatValue(value: any, depth: number, usedWidth: number, trailingWidth: number): string
{
    if (!isContainer(value) || isEmpty(value))
        return formatInline(value);

    if (depth >= MIN_COMPACT_DEPTH)
    {
        const inline = formatInline(value);
        if (usedWidth + inline.length + trailingWidth <= MAX_LINE_WIDTH)
            return inline;

        const members = getMembers(value);
        if (members.length == 1 && isRecord(members[0].value) && !isEmpty(members[0].value))
        {
            const open = Array.isArray(value) ? "[" : `{${members[0].keyText}`;
            const close = Array.isArray(value) ? "]" : "}";
            return open + formatSpread(members[0].value, depth) + close;
        }
    }
    return formatSpread(value, depth);
}

// Members one per line, one level deeper than the line the container opens on.
function formatSpread(value: any, depth: number): string
{
    const memberIndent = INDENT.repeat(depth + 1);
    const members = getMembers(value);
    const lines = members.map((member, i) => {
        const trailingWidth = (i < members.length - 1) ? 1 : 0;
        return memberIndent + member.keyText + formatValue(member.value, depth + 1,
            memberIndent.length + member.keyText.length, trailingWidth);
    });
    const [open, close] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
    return `${open}\n${lines.join(",\n")}\n${INDENT.repeat(depth)}${close}`;
}

function formatInline(value: any): string
{
    if (Array.isArray(value))
        return `[${value.map(formatInline).join(", ")}]`;
    if (isRecord(value))
        return `{${getKeys(value).map(key => `${JSON.stringify(key)}: ${formatInline(value[key])}`).join(", ")}}`;
    return JSON.stringify(value);
}

function getMembers(value: any): {keyText: string, value: any}[]
{
    if (Array.isArray(value))
        return value.map(item => ({keyText: "", value: item}));
    return getKeys(value).map(key => ({keyText: `${JSON.stringify(key)}: `, value: value[key]}));
}

// As JSON.stringify does, a member set to undefined is left out.
function getKeys(record: {[key: string]: any}): string[]
{
    return Object.keys(record).filter(key => record[key] !== undefined);
}

function isContainer(value: any): boolean
{
    return Array.isArray(value) || isRecord(value);
}

function isEmpty(value: any): boolean
{
    return Array.isArray(value) ? value.length == 0 : getKeys(value).length == 0;
}

function isRecord(value: any): value is {[key: string]: any}
{
    return typeof value == "object" && value != null && !Array.isArray(value);
}
