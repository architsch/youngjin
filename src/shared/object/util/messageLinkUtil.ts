import MessageSegment from "../types/messageSegment";
import { ScreenControl } from "../types/screenControl";
import ScreenControlMap from "../maps/screenControlMap";
import StringUtil from "../../math/util/stringUtil";
import { MESSAGE_LINK_ADDRESS_MAX_LENGTH, MESSAGE_LINK_LABEL_MAX_LENGTH,
    MESSAGE_LINK_MAX_COUNT } from "../../system/sharedConstants";

// How a link is written in a message, spaces and letter case aside, as models and agents write it.
const LINK_TAG = /<link\s+href\s*=\s*"([^"]*)"\s*>([^<]*)<\/link\s*>/gi;
// How a picture of a control is written, closed or not, as models write it.
const CONTROL_TAG = /<control\s+name\s*=\s*"([^"]*)"\s*\/?\s*>(?:<\/control\s*>)?/gi;
// A web address written as it is (the second group), from its scheme or "www." to the first space, quote or angle
// bracket, where no word runs into it (the first group).
const BARE_ADDRESS = /(^|[^\w@./-])((?:https?:\/\/|www\.)[^\s<>"]+)/gi;
// What ends the sentence an address closes, rather than the address.
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]+$/;
const LINK_MARKUP_LENGTH = `<link href=""></link>`.length;
// The most characters a picture of a control is written in for each it counts as (see getMaxLength).
const CONTROL_MARKUP_PER_SHOWN_CHAR = Math.max(1, ...ScreenControlMap.getControls().map(control =>
    formatControl(control).length / Array.from(toShownText({kind: "control", control})).length));
const MAX_CANONICALIZING_PASSES = 8;
const CUT_MARK = "...";

// Links in what players and NPCs say (their SentMessage), written <link href="https://...">label</link> and shown as a
// button with that label, or else the site's name (see SpeechBubble). Whoever writes a message, a person's chat input,
// an agent or a helper, a bare web address in it becomes a link as it is stored (see canonicalize), and only what is
// shown counts toward its length. A message also shows a picture of a control on the screen where it is written
// <control name="..."/> (see ScreenControlMap), as helpers name one rather than say where it is.
const MessageLinkUtil =
{
    // The message as text, links and pictures, in order. Only a well-formed link to a web page is one: another is its
    // label alone (its address, if it has none), as are those past the most a message holds. A picture no control has
    // the name of is that name. Pictures and bare addresses are looked for once links are found, since an address may
    // run on into the text beside it.
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
            // A label longer than a button shows (a title, as models often write one) is said before it in full, and
            // the button named by its site, rather than cut short.
            else if (Array.from(label).length > MESSAGE_LINK_LABEL_MAX_LENGTH)
            {
                addText(written, `${label} `);
                written.push({kind: "link", href, label: MessageLinkUtil.getSiteName(href)});
            }
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
            else if (segment.kind == "text")
                addControls(segments, segment.text, addLink);
        }
        return segments;
    },
    format: (segments: MessageSegment[]): string =>
    {
        return segments.map(segment => (segment.kind == "text") ? segment.text
            : (segment.kind == "link") ? `<link href="${segment.href}">${segment.label}</link>`
            : formatControl(segment.control)).join("");
    },
    // What a message shows, as text: its text, each link as its label, and each picture as its control's words.
    getVisibleText: (segments: MessageSegment[]): string =>
    {
        return segments.map(toShownText).join("");
    },
    // In code points.
    getVisibleLength: (message: string): number =>
    {
        return Array.from(MessageLinkUtil.getVisibleText(MessageLinkUtil.parse(message))).length;
    },
    // The most characters a message showing so many may hold, its markup and links' addresses included.
    getMaxLength: (maxVisibleLength: number): number =>
    {
        return Math.ceil(maxVisibleLength * CONTROL_MARKUP_PER_SHOWN_CHAR)
            + MESSAGE_LINK_MAX_COUNT * (LINK_MARKUP_LENGTH + MESSAGE_LINK_ADDRESS_MAX_LENGTH);
    },
    // The message as told to whoever has no screen to see its pictures (an agent): each as its control's words, and its
    // links as written.
    withControlsInWords: (message: string): string =>
    {
        return MessageLinkUtil.format(MessageLinkUtil.parse(message).map((segment): MessageSegment =>
            (segment.kind == "control") ? {kind: "text", text: toShownText(segment)} : segment));
    },
    // As a message is stored: trimmed, with its links and pictures as parse finds them, and cut to show no more than so
    // many characters (a link or a picture kept whole or not at all). Doing it twice changes nothing: a cut can leave
    // text that reads as an address, so it is done until it does, each time only shortening what is shown.
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
    // As canonicalize, but where it must be cut, cut after the last sentence that fits, else the last word. A link said
    // as a sentence of its own, as helpers end a reply ("... a story in 12 chapters. Read it."), is kept where the cut
    // would leave every link out: after the last whole sentence that fits with it, unless what is cut from between them
    // names something (in quotes, as a title), which its words would then be taken for.
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
        const shortened = (sentenceEnd > 0) ? cutAfter(sentenceEnd + 1, true)
            : cutAfter(Math.max(0, within.lastIndexOf(" ")), false);

        const alone = findLinkAlone(segments);
        if (alone == undefined || MessageLinkUtil.parse(shortened).some(segment => segment.kind == "link"))
            return shortened;
        const leading = segments.slice(0, alone.index);
        const endingLength = Array.from(`${alone.link.label}${alone.after}`).length;
        const kept = keepWholeSentences(leading, maxVisibleLength - endingLength - 1);
        if (kept == undefined)
            return shortened;
        const left = MessageLinkUtil.getVisibleText(leading).slice(MessageLinkUtil.getVisibleText(kept).length);
        return /["“”]/.test(left) ? shortened
            : `${MessageLinkUtil.format(kept).trim()} ${MessageLinkUtil.format([alone.link])}${alone.after}`;
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

// A label on one line, as a button shows it.
function normalizeLabel(label: string): string
{
    return label.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

function formatControl(control: ScreenControl): string
{
    return `<control name="${control}"/>`;
}

// What a segment shows, as text: a link its label, and a picture its control's words, in brackets.
function toShownText(segment: MessageSegment): string
{
    return (segment.kind == "text") ? segment.text : (segment.kind == "link") ? segment.label
        : `[${ScreenControlMap.getWords(segment.control)}]`;
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

// Text with each picture written in it made one, and each bare web address in the rest a link.
function addControls(segments: MessageSegment[], text: string,
    addLink: (link: MessageSegment & {kind: "link"}, otherwise: string) => void): void
{
    let index = 0;
    for (const match of text.matchAll(CONTROL_TAG))
    {
        const start = match.index ?? 0;
        addBareAddresses(segments, text.slice(index, start), addLink);
        const control = ScreenControlMap.read(match[1]);
        if (control != undefined)
            segments.push({kind: "control", control});
        else
            addText(segments, normalizeLabel(match[1]));
        index = start + match[0].length;
    }
    addBareAddresses(segments, text.slice(index), addLink);
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

// The first link said as a sentence of its own: after a sentence's end (or nothing), and before nothing but the mark
// that ends it and what follows that. Its place among the segments, and that mark.
function findLinkAlone(segments: MessageSegment[]): {index: number, link: MessageSegment & {kind: "link"}, after: string}
    | undefined
{
    for (let index = 0; index < segments.length; ++index)
    {
        const segment = segments[index];
        if (segment.kind != "link")
            continue;
        const previous = segments[index - 1];
        const next = segments[index + 1];
        const startsSentence = previous == undefined || (previous.kind == "text" && /[.!?]\s+$/.test(previous.text));
        const ending = (next == undefined) ? "" : (next.kind == "text") ? next.text.match(/^[.!?]?(?=\s|$)/)?.[0] : undefined;
        if (startsSentence && ending != undefined)
            return {index, link: segment, after: ending};
    }
    return undefined;
}

// The segments cut after the last whole sentence among them that shows within so many characters (all of them, if
// they do), or undefined where none does.
function keepWholeSentences(segments: MessageSegment[], maxVisibleLength: number): MessageSegment[] | undefined
{
    const shown = Array.from(MessageLinkUtil.getVisibleText(segments));
    if (shown.length <= maxVisibleLength)
        return (MessageLinkUtil.getVisibleText(segments).trim().length > 0) ? segments : undefined;
    const within = shown.slice(0, Math.max(0, maxVisibleLength + 1)).join("");
    const sentenceEnd = Math.max(within.lastIndexOf(". "), within.lastIndexOf("! "), within.lastIndexOf("? "));
    if (sentenceEnd <= 0)
        return undefined;
    const length = Array.from(within.slice(0, sentenceEnd + 1)).length;
    const kept = cut(segments, length);
    // Not where a link the sentence's end falls in would be left out.
    return (Array.from(MessageLinkUtil.getVisibleText(kept)).length == length) ? kept : undefined;
}

// The segments that show no more than so many characters: text cut to fit, a link or a picture only if it fits whole.
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
        const shownLength = Array.from(toShownText(segment)).length;
        if (shownLength > left)
            break;
        kept.push(segment);
        left -= shownLength;
    }
    return kept;
}

export default MessageLinkUtil;
