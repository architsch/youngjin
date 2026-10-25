import MessageSegment from "../../../shared/object/types/messageSegment";
import MessageLinkUtil from "../../../shared/object/util/messageLinkUtil";

// How a link looks in a line of chat (see ChatTextInput, ChatSentMessage): a chip of its label.
const CHIP_CLASS_NAMES = "inline-block align-middle h-6 leading-6 px-1.5 mx-0.5 rounded-md text-sm font-semibold "
    + "text-white bg-sky-700 select-none";

// Editing the chat input (see ChatTextInput): a line of text in which each web address becomes a chip, the link the
// message carries (see MessageLinkUtil), which the caret steps over and Backspace takes away whole.
const ChatInputEditUtil =
{
    chipClassNames: CHIP_CLASS_NAMES,
    // Shows a message in the editor, its links as chips and its pictures as written, to edit as text.
    show: (editor: HTMLElement, message: string): void =>
    {
        editor.replaceChildren(...MessageLinkUtil.parse(message).map(segment => (segment.kind == "link")
            ? createChip(segment.href, segment.label)
            : document.createTextNode((segment.kind == "text") ? segment.text : MessageLinkUtil.format([segment]))));
    },
    // The message the editor holds: its text, and each chip as its link.
    read: (editor: HTMLElement): string =>
    {
        return MessageLinkUtil.format(getContent(editor).map((node): MessageSegment => isChip(node)
            ? {kind: "link", href: node.dataset.href!, label: node.textContent ?? ""}
            : {kind: "text", text: (node as Text).data.replace(/\s/g, " ")}));
    },
    // Makes a chip of each web address written out in full, which a space after it says it is, or of every one.
    linkAddresses: (editor: HTMLElement, all: boolean): void =>
    {
        const made: HTMLElement[] = [];
        for (const node of getContent(editor))
        {
            if (isChip(node))
                continue;
            const text = node as Text;
            const found = MessageLinkUtil.findBareAddresses(text.data)
                .filter(address => all || /\s/.test(text.data.charAt(address.runEnd)));
            // From the last, so the offsets of those before it hold. The caret moves with the text it is in (see
            // Text.splitText), and from within an address, past its chip.
            for (const {start, end, href} of found.reverse())
            {
                text.splitText(end);
                const address = text.splitText(start);
                const chip = createChip(href, MessageLinkUtil.getSiteName(href));
                const caretInAddress = window.getSelection()?.anchorNode === address;
                address.replaceWith(chip);
                made.push(chip);
                if (caretInAddress)
                    placeCaretAfter(chip);
            }
        }
        editor.normalize();
        // A chip just made to end the line gets a space after it, to type on from (one that ends it as what came after
        // it is deleted is left alone, so that Backspace can reach it).
        const last = editor.lastChild;
        if (isChip(last) && made.includes(last))
        {
            const space = document.createTextNode(" ");
            last.after(space);
            const selection = window.getSelection();
            if (selection?.anchorNode === editor && selection.anchorOffset == editor.childNodes.length - 1)
                placeCaretAfter(space);
        }
    },
    // Takes away the chip just before the caret (or after it, going forward), if there is one there.
    removeChipAt: (editor: HTMLElement, backward: boolean): boolean =>
    {
        const selection = window.getSelection();
        if (selection == null || selection.rangeCount == 0 || !selection.isCollapsed)
            return false;
        const {startContainer: container, startOffset: offset} = selection.getRangeAt(0);
        let neighbor: Node | null = null;
        if (container instanceof Text)
        {
            if (backward && offset == 0)
                neighbor = getSibling(container, true);
            else if (!backward && offset == container.length)
                neighbor = getSibling(container, false);
        }
        else if (editor.contains(container))
            neighbor = container.childNodes[backward ? offset - 1 : offset] ?? null;
        if (!isChip(neighbor))
            return false;
        neighbor.remove();
        editor.normalize();
        return true;
    },
    // Cuts what the editor shows down to so many characters, a chip counting as its label, from the end, as the chat
    // input always has.
    limit: (editor: HTMLElement, maxVisibleLength: number): void =>
    {
        const content = getContent(editor);
        let excess = content.reduce((sum, node) => sum + Array.from(node.textContent ?? "").length, 0)
            - maxVisibleLength;
        if (excess <= 0)
            return;
        for (const node of content.reverse())
        {
            const codePoints = Array.from(node.textContent ?? "");
            if (isChip(node) || codePoints.length <= excess)
            {
                node.remove();
                excess -= codePoints.length;
            }
            else
            {
                (node as Text).data = codePoints.slice(0, codePoints.length - excess).join("");
                excess = 0;
            }
            if (excess <= 0)
                break;
        }
        const last = editor.lastChild;
        if (last != null)
            placeCaretAfter(last);
    },
    // Text typed at the caret, as a paste puts it there.
    insertText: (editor: HTMLElement, text: string): void =>
    {
        if (document.execCommand("insertText", false, text))
            return;
        const selection = window.getSelection();
        if (selection == null || selection.rangeCount == 0 || !editor.contains(selection.anchorNode))
        {
            editor.append(text);
            return;
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const node = document.createTextNode(text);
        range.insertNode(node);
        placeCaretAfter(node);
    },
}

function createChip(href: string, label: string): HTMLElement
{
    const chip = document.createElement("span");
    chip.contentEditable = "false";
    chip.dataset.href = href;
    chip.title = href;
    chip.className = CHIP_CLASS_NAMES;
    chip.textContent = label;
    return chip;
}

function isChip(node: Node | null): node is HTMLElement
{
    return node instanceof HTMLElement && node.dataset.href != undefined;
}

// The editor's text and chips in order: a chip whole, and of anything else a browser put there (a line break, a
// wrapping element) the text in it.
function getContent(node: Node): (Text | HTMLElement)[]
{
    const content: (Text | HTMLElement)[] = [];
    for (const child of Array.from(node.childNodes))
    {
        if (child instanceof Text)
            content.push(child);
        else if (isChip(child))
            content.push(child);
        else
            content.push(...getContent(child));
    }
    return content;
}

// The node next to one, past any empty text.
function getSibling(node: Node, before: boolean): Node | null
{
    let sibling = before ? node.previousSibling : node.nextSibling;
    while (sibling instanceof Text && sibling.length == 0)
        sibling = before ? sibling.previousSibling : sibling.nextSibling;
    return sibling;
}

function placeCaretAfter(node: Node): void
{
    const selection = window.getSelection();
    if (selection == null)
        return;
    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

export default ChatInputEditUtil;
