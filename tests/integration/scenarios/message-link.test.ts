/**
 * Integration tests: links in what players and NPCs say (see MessageLinkUtil), written
 * <link href="https://...">label</link>: which are links, what a message shows, and how it is stored and cut.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import MessageLinkUtil from "../../../src/shared/object/util/messageLinkUtil";
import { MESSAGE_LINK_ADDRESS_MAX_LENGTH, MESSAGE_LINK_LABEL_MAX_LENGTH, MESSAGE_LINK_MAX_COUNT,
    NPC_MESSAGE_MAX_LENGTH } from "../../../src/shared/system/sharedConstants";

const ESSAY = "https://thingspool.net/essays/page-12.html";
const link = (href: string, label: string) => `<link href="${href}">${label}</link>`;

describe("message links", () => {
    it("are found where written, labelled as written or by their site, and nothing else is one", () => {
        expect(MessageLinkUtil.parse("just words")).toEqual([{kind: "text", text: "just words"}]);
        expect(MessageLinkUtil.parse(`read it ${link(ESSAY, "here")}!`)).toEqual([
            {kind: "text", text: "read it "},
            {kind: "link", href: ESSAY, label: "here"},
            {kind: "text", text: "!"},
        ]);
        // As models and agents write them: spacing and letter case aside, and the label left out.
        expect(MessageLinkUtil.parse(`<LINK HREF = "${ESSAY}" >  a   good\nread </Link>`))
            .toEqual([{kind: "link", href: ESSAY, label: "a good read"}]);
        expect(MessageLinkUtil.parse(link("https://www.linkedin.com/in/someone", "")))
            .toEqual([{kind: "link", href: "https://www.linkedin.com/in/someone", label: "linkedin.com"}]);
        expect(MessageLinkUtil.parse(link(ESSAY, "x".repeat(MESSAGE_LINK_LABEL_MAX_LENGTH + 5))))
            .toEqual([{kind: "link", href: ESSAY, label: `${"x".repeat(MESSAGE_LINK_LABEL_MAX_LENGTH - 1)}…`}]);
        expect(MessageLinkUtil.parse(link(ESSAY, "x".repeat(MESSAGE_LINK_LABEL_MAX_LENGTH))))
            .toEqual([{kind: "link", href: ESSAY, label: "x".repeat(MESSAGE_LINK_LABEL_MAX_LENGTH)}]);

        // Anything but a web page's address is its label alone, or its address as text.
        for (const href of ["javascript:alert(1)", "data:text/html,hi", "ftp://thingspool.net/", "https://", "thingspool",
            "https://user:secret@thingspool.net/", `https://thingspool.net/${"a".repeat(MESSAGE_LINK_ADDRESS_MAX_LENGTH)}`])
        {
            expect(MessageLinkUtil.parse(link(href, "click")), href).toEqual([{kind: "text", text: "click"}]);
        }
        expect(MessageLinkUtil.parse(link("javascript:alert(1)", ""))).toEqual([{kind: "text", text: "javascript:alert(1)"}]);
        // A tag left open is text, the address in it a link of its own.
        expect(MessageLinkUtil.parse(`<link href="${ESSAY}">here`)).toEqual([
            {kind: "text", text: "<link href=\""},
            {kind: "link", href: ESSAY, label: "thingspool.net"},
            {kind: "text", text: "\">here"},
        ]);
    });

    it("are made of bare web addresses, the punctuation after one left as text, and never from inside a word", () => {
        expect(MessageLinkUtil.parse(`see ${ESSAY}.`)).toEqual([
            {kind: "text", text: "see "},
            {kind: "link", href: ESSAY, label: "thingspool.net"},
            {kind: "text", text: "."},
        ]);
        expect(MessageLinkUtil.parse("(www.thingspool.net/arcade.html), fun")).toEqual([
            {kind: "text", text: "("},
            {kind: "link", href: "https://www.thingspool.net/arcade.html", label: "thingspool.net"},
            {kind: "text", text: "), fun"},
        ]);
        expect(MessageLinkUtil.parse("http://127.0.0.1:3000/AbCdEfGhIjKlMnOpQrSt")).toEqual([
            {kind: "link", href: "http://127.0.0.1:3000/AbCdEfGhIjKlMnOpQrSt", label: "127.0.0.1"}]);
        for (const text of ["awww.com", "me@www.x.com", "xhttps://thingspool.net", "www.", "https://"])
            expect(MessageLinkUtil.parse(text), text).toEqual([{kind: "text", text}]);
    });

    it("are at most so many to a message, those past it shown as their labels, or their addresses", () => {
        const many = Array.from({length: MESSAGE_LINK_MAX_COUNT + 2}, (_, i) => `https://thingspool.net/${i}`);
        const segments = MessageLinkUtil.parse(`${link(many[0], "a")} ${many.slice(1).join(" ")}`);
        expect(segments.filter(segment => segment.kind == "link")).toHaveLength(MESSAGE_LINK_MAX_COUNT);
        expect(MessageLinkUtil.getVisibleText(segments)).toBe(["a", ...Array(MESSAGE_LINK_MAX_COUNT - 1)
            .fill("thingspool.net"), ...many.slice(MESSAGE_LINK_MAX_COUNT)].join(" "));
    });

    it("count toward a message's length as their labels, never their addresses", () => {
        expect(MessageLinkUtil.getVisibleLength(`read it ${link(ESSAY, "here")}`)).toBe("read it here".length);
        expect(MessageLinkUtil.getVisibleLength(`see ${ESSAY}`)).toBe("see thingspool.net".length);
        expect(MessageLinkUtil.getVisibleLength("한국어 😀")).toBe(5);
        expect(MessageLinkUtil.getMaxLength(72)).toBeGreaterThanOrEqual(72 + MESSAGE_LINK_MAX_COUNT
            * (link("", "").length + MESSAGE_LINK_ADDRESS_MAX_LENGTH));
    });

    it("are stored whole or not at all, in a message cut to what it may show", () => {
        expect(MessageLinkUtil.canonicalize(`  hi ${ESSAY}  `, NPC_MESSAGE_MAX_LENGTH))
            .toBe(`hi ${link(ESSAY, "thingspool.net")}`);
        expect(MessageLinkUtil.canonicalize(`abc ${link(ESSAY, "a long label")} def`, 10)).toBe("abc");
        expect(MessageLinkUtil.canonicalize(`ab ${link(ESSAY, "here")} defgh`, 10)).toBe(`ab ${link(ESSAY, "here")} de`);
        expect(MessageLinkUtil.canonicalize("😀".repeat(5), 3)).toBe("😀".repeat(3));
    });

    it("are kept whole when a reply is shortened, after its last sentence that fits or else its last word", () => {
        const reply = `Try ${link(ESSAY, "this essay")}, a funny one. It says cats tamed us for free, and we pay in cuteness.`;
        expect(MessageLinkUtil.shorten(reply, 200)).toBe(reply);
        expect(MessageLinkUtil.shorten(reply, 40)).toBe(`Try ${link(ESSAY, "this essay")}, a funny one.`);
        expect(MessageLinkUtil.shorten(reply, 20)).toBe(`Try ${link(ESSAY, "this essay")},...`);
        // A sentence ending within a label doesn't split the link.
        expect(MessageLinkUtil.shorten(`Look: ${link(ESSAY, "Hi. Bye. Now")} and more words`, 14)).toBe("Look:...");
    });

    it("leave a message alone when stored again, and never show more than it may", () => {
        const piece = fc.oneof(
            fc.string({maxLength: 12}),
            fc.constantFrom(ESSAY, "www.thingspool.net", "https://", " ", ".", "<", ">", "\"", "<link href=\"", "\">",
                "</link>", link(ESSAY, "here"), link("javascript:x", "bad"), "한", "😀"));
        fc.assert(fc.property(fc.array(piece, {maxLength: 12}), fc.integer({min: 0, max: 80}), (pieces, max) => {
            const once = MessageLinkUtil.canonicalize(pieces.join(""), max);
            expect(MessageLinkUtil.canonicalize(once, max)).toBe(once);
            expect(MessageLinkUtil.getVisibleLength(once)).toBeLessThanOrEqual(max);
            expect(MessageLinkUtil.getVisibleLength(MessageLinkUtil.shorten(pieces.join(""), max)))
                .toBeLessThanOrEqual(Math.max(max, 3));
            expect(MessageLinkUtil.parse(once).filter(segment => segment.kind == "link").length)
                .toBeLessThanOrEqual(MESSAGE_LINK_MAX_COUNT);
        }));
    });
});
