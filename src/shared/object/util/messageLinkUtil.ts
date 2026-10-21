import MessageSegment from "../types/messageSegment";
import StringUtil from "../../math/util/stringUtil";
import { MESSAGE_LINK_ADDRESS_MAX_LENGTH, MESSAGE_LINK_LABEL_MAX_LENGTH,
    MESSAGE_LINK_MAX_COUNT } from "../../system/sharedConstants";

// How a link is written in a message, spaces and letter case aside, as models and agents write it.
const LINK_TAG = /<link\s+href\s*=\s*"([^"]*)"\s*>([^<]*)<\/link\s*>/gi;
// A web address written as it is (the second group), from its scheme or "www." to the first space, quote or angle
// bracket, where no word runs into it (the first group).
const BARE_ADDRESS = /(^|[^\w@./-])((?:https?:\/\/|www\.)[^\s<>"]+)/gi;
// What ends the sentence an address closes, rather than the address.
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]+$/;
const LINK_MARKUP_LENGTH = `<link href=""></link>`.length;
const MAX_CANONICALIZING_PASSES = 8;
const CUT_MARK = "...";

// Links in what players and NPCs say (their SentMessage), written <link href="https://...">label</link> and shown as a
// button with that label, or else the site's name (see SpeechBubble). Whoever writes a message, a person's chat input,
// an agent or a helper, a bare web address in it becomes a link as it is stored (see canonicalize), and only what is
// shown counts toward its length.
const MessageLinkUtil =
{
    // The message as text and links, in order. Only a well-formed link to a web page is one: another is its label alone
    // (its address, if it has none), as are those past the most a message holds. Bare addresses are looked for once
    // those are text, since one may run on into the text beside it.
    parse: (message: string): MessageSegment[] =>
    {
        const written: MessageSegment[] = [];
        let index = 0;
        for (const match of message.matchAll(LINK_TAG))
        {
            const start = match.index ?? 0;
            addText(written, message.slice(index, start));
            const href = toWebAddress(match[1]);
            const label = normalizeLabel(match[2]);
            if (href == undefined)
                addText(written, label.length > 0 ? label : match[1]);
            else
                written.push({kind: "link", href, label: label.length > 0 ? label : MessageLinkUtil.getSiteName(href)});
            index = start + match[0].length;
        }
        addText(written, message.slice(index));

        const segments: MessageSegment[] = [];
        let linkCount = 0;
        const addLink = (link: MessageSegment & {kind: "link"}, otherwise: string) => {
            if (linkCount >= MESSAGE_LINK_MAX_COUNT)
                addText(segments, otherwise);
            else
            {
                ++linkCount;
                segments.push(link);
            }
        };
        for (const segment of written)
        {
            if (segment.kind == "link")
                addLink(segment, segment.label);
            else
                addBareAddresses(segments, segment.text, addLink);
        }
        return segments;
    },
    format: (segments: MessageSegment[]): string =>
    {
        return segments.map(segment => (segment.kind == "text") ? segment.text
            : `<link href="${segment.href}">${segment.label}</link>`).join("");
    },
    // What a message shows: its text, and each link as its label.
    getVisibleText: (segments: MessageSegment[]): string =>
    {
        return segments.map(segment => (segment.kind == "text") ? segment.text : segment.label).join("");
    },
    // In code points.
    getVisibleLength: (message: string): number =>
    {
        return Array.from(MessageLinkUtil.getVisibleText(MessageLinkUtil.parse(message))).length;
    },
    // The most characters a message showing so many may hold, its links' markup and addresses included.
    getMaxLength: (maxVisibleLength: number): number =>
    {
        return maxVisibleLength + MESSAGE_LINK_MAX_COUNT * (LINK_MARKUP_LENGTH + MESSAGE_LINK_ADDRESS_MAX_LENGTH);
    },
    // As a message is stored: trimmed, with its links as parse finds them, and cut to show no more than so many
    // characters (a link kept whole or not at all). Doing it twice changes nothing: a cut can leave text that reads as
    // an address, so it is done until it does, each time only shortening what is shown.
    canonicalize: (message: string, maxVisibleLength: number): string =>
    {
        let canonical = message;
        for (let i = 0; i < MAX_CANONICALIZING_PASSES; ++i)
        {
            const next = MessageLinkUtil.format(cut(MessageLinkUtil.parse(canonical.trim()), maxVisibleLength)).trim();
            if (next == canonical)
                break;
            canonical = next;
        }
        return canonical;
    },
    // As canonicalize, but where it must be cut, cut after the last sentence that fits, else the last word.
    shorten: (message: string, maxVisibleLength: number): string =>
    {
        const segments = MessageLinkUtil.parse(message.trim());
        const shown = Array.from(MessageLinkUtil.getVisibleText(segments));
        if (shown.length <= maxVisibleLength)
            return MessageLinkUtil.format(segments).trim();
        // With room left for the mark of a cut, which goes where it doesn't end a sentence, as when a link the cut runs
        // through is left out.
        const within = shown.slice(0, Math.max(0, maxVisibleLength - CUT_MARK.length)).join("");
        const cutAfter = (end: number, endsSentence: boolean) => {
            const length = Array.from(within.slice(0, end)).length;
            const kept = cut(segments, length);
            const shortened = MessageLinkUtil.format(kept).trim();
            return (endsSentence && Array.from(MessageLinkUtil.getVisibleText(kept)).length == length) ? shortened
                : `${shortened}${CUT_MARK}`;
        };
        const sentenceEnd = Math.max(within.lastIndexOf(". "), within.lastIndexOf("! "), within.lastIndexOf("? "));
        return (sentenceEnd > 0) ? cutAfter(sentenceEnd + 1, true) : cutAfter(Math.max(0, within.lastIndexOf(" ")), false);
    },
    // Where text holds bare web addresses: each one's start and end, the end of the run of characters it is written in
    // (what punctuation follows it included), and the address its link holds.
    findBareAddresses: (text: string): {start: number, end: number, runEnd: number, href: string}[] =>
    {
        const found: {start: number, end: number, runEnd: number, href: string}[] = [];
        for (const match of text.matchAll(BARE_ADDRESS))
        {
            const start = (match.index ?? 0) + match[1].length;
            const address = match[2].replace(TRAILING_PUNCTUATION, "");
            const href = toWebAddress(address);
            if (href != undefined)
                found.push({start, end: start + address.length, runEnd: start + match[2].length, href});
        }
        return found;
    },
    // The site a web address is on, as a link to it is labelled when it has no label of its own.
    getSiteName: (href: string): string =>
    {
        return StringUtil.truncateByCodePoints(new URL(href).hostname.replace(/^www\./, ""),
            MESSAGE_LINK_LABEL_MAX_LENGTH);
    },
}

// A web page's address as a link holds it (scheme and host as a browser writes them), or undefined for anything else.
function toWebAddress(address: string): string | undefined
{
    const written = address.trim();
    let url: URL;
    try
    {
        url = new URL(/^www\./i.test(written) ? `https://${written}` : written);
    }
    catch
    {
        return undefined;
    }
    if ((url.protocol != "https:" && url.protocol != "http:") || url.hostname.length == 0 || url.username.length > 0
        || url.password.length > 0)
    {
        return undefined;
    }
    return (url.href.length <= MESSAGE_LINK_ADDRESS_MAX_LENGTH && !/[\s"<>]/.test(url.href)) ? url.href : undefined;
}

// A label as a button shows it: one line, and one too long cut to fit, which it says.
function normalizeLabel(label: string): string
{
    const codePoints = Array.from(label.replace(/[<>]/g, "").replace(/\s+/g, " ").trim());
    return (codePoints.length <= MESSAGE_LINK_LABEL_MAX_LENGTH) ? codePoints.join("")
        : `${codePoints.slice(0, MESSAGE_LINK_LABEL_MAX_LENGTH - 1).join("").trimEnd()}…`;
}

// Text, run on into the text before it.
function addText(segments: MessageSegment[], text: string): void
{
    if (text.length == 0)
        return;
    const last = segments[segments.length - 1];
    if (last?.kind == "text")
        last.text += text;
    else
        segments.push({kind: "text", text});
}

// Text with each bare web address in it a link labelled by its site, or else left as written.
function addBareAddresses(segments: MessageSegment[], text: string,
    addLink: (link: MessageSegment & {kind: "link"}, otherwise: string) => void): void
{
    let index = 0;
    for (const {start, end, href} of MessageLinkUtil.findBareAddresses(text))
    {
        addText(segments, text.slice(index, start));
        addLink({kind: "link", href, label: MessageLinkUtil.getSiteName(href)}, text.slice(start, end));
        index = end;
    }
    addText(segments, text.slice(index));
}

// The segments that show no more than so many characters: text cut to fit, a link only if its whole label fits.
function cut(segments: MessageSegment[], maxVisibleLength: number): MessageSegment[]
{
    const kept: MessageSegment[] = [];
    let left = maxVisibleLength;
    for (const segment of segments)
    {
        if (left <= 0)
            break;
        if (segment.kind == "text")
        {
            const codePoints = Array.from(segment.text);
            kept.push({kind: "text", text: codePoints.slice(0, left).join("")});
            left -= Math.min(left, codePoints.length);
            continue;
        }
        const labelLength = Array.from(segment.label).length;
        if (labelLength > left)
            break;
        kept.push(segment);
        left -= labelLength;
    }
    return kept;
}

export default MessageLinkUtil;
