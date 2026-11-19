/**
 * The site as the generator builds it: that the folders its data names hold what their pages are built from, how a
 * source's text becomes pages, and what a build writes. `npm test` runs it.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import SSG from "../ssg.ts";
import FileUtil, { SOURCE_FILE_NAME } from "../util/fileUtil.ts";
import EJSUtil from "../util/ejsUtil.ts";
import ArcadeGamePageBuilder from "../builder/page/arcadeGamePageBuilder.ts";
import LibraryPostPageBuilder from "../builder/page/libraryPostPageBuilder.ts";
import styleDictionary from "../style/styleDictionary.ts";
import type SitemapBuilder from "../builder/sitemapBuilder.ts";
import type AtomFeedBuilder from "../builder/atomFeedBuilder.ts";
import { ArcadeData } from "../data/arcadeData.ts";
import { LibraryData } from "../data/libraryData.ts";
import { FeedTopicData } from "../data/feedTopicData.ts";
import { GLOBAL_LAST_MOD, URL_ROBOT_ROOMS, URL_STATIC } from "../siteConstants.ts";

type SitemapEntry = [relativeURL: string, lastmod: string | undefined];
type FeedEntry = {url: string, title: string, lastmod: string, description: string};

let siteDir: string | undefined;

// A site folder of the test's own, holding one folder with the given source.
function makeSite(dirName: string, source: string): string
{
    siteDir = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
    fs.mkdirSync(path.join(siteDir, dirName));
    fs.writeFileSync(path.join(siteDir, dirName, SOURCE_FILE_NAME), source);
    FileUtil.configure({rootDir: siteDir});
    return siteDir;
}

function makeIndexes(): {sitemap: SitemapEntry[], feed: FeedEntry[], sitemapBuilder: SitemapBuilder, atomFeedBuilder: AtomFeedBuilder}
{
    const sitemap: SitemapEntry[] = [];
    const feed: FeedEntry[] = [];
    return {
        sitemap, feed,
        sitemapBuilder: {addEntry: (relativeURL: string, lastmod?: string) => { sitemap.push([relativeURL, lastmod]); }} as unknown as SitemapBuilder,
        atomFeedBuilder: {addEntry: (url: string, title: string, lastmod: string, description: string) => {
            feed.push({url, title, lastmod, description});
        }} as unknown as AtomFeedBuilder,
    };
}

afterEach(() => {
    if (siteDir != undefined)
        fs.rmSync(siteDir, {recursive: true, force: true});
    siteDir = undefined;
    FileUtil.configure();
});

describe("the site's data", () => {
    it("names, for every arcade game, a folder with its banner and its source", () => {
        assert.ok(ArcadeData.gameEntries.length > 0);
        for (const entry of ArcadeData.gameEntries)
        {
            assert.ok(FileUtil.exists(`${entry.dirName}/entry.jpg`), `${entry.dirName}/entry.jpg`);
            assert.ok(FileUtil.exists(`${entry.dirName}/${SOURCE_FILE_NAME}`), `${entry.dirName}/${SOURCE_FILE_NAME}`);
            if (entry.shareImage != undefined)
                assert.ok(FileUtil.exists(entry.shareImage.path), entry.shareImage.path);
        }
    });

    it("names, for every library list, a folder with its source", () => {
        const entries = Object.values(LibraryData.entriesByCategory).flat();
        assert.ok(entries.length > 0);
        for (const entry of entries)
            assert.ok(FileUtil.exists(`${entry.dirName}/${SOURCE_FILE_NAME}`), `${entry.dirName}/${SOURCE_FILE_NAME}`);
        assert.equal(new Set(entries.map(entry => entry.dirName)).size, entries.length, "a folder named twice");
    });

    it("links the home page only to game pages the arcade builds, and to Robot Rooms", async () => {
        const page = await EJSUtil.createStaticHTMLFromEJS("page/static/index.ejs");
        const linked = [...page.matchAll(new RegExp(`href="${URL_STATIC}/([^/"]+)/page\\.html"`, "g"))].map(match => match[1]);
        assert.ok(linked.length > 0);
        for (const dirName of linked)
            assert.ok(ArcadeData.gameEntries.some(entry => entry.dirName == dirName), dirName);
        assert.ok(page.includes(`href="${URL_ROBOT_ROOMS}"`));
    });

    it("groups Robot Rooms' Play button with its paragraph: beside it on a wide screen, under it on a tall one", async () => {
        const page = await EJSUtil.createStaticHTMLFromEJS("page/static/index.ejs");
        assert.match(page, new RegExp(`<div class="imageButtonGroup">\\s*<p>[^]*?</p>\\s*`
            + `<a class="noTextDeco imageButton" href="${URL_ROBOT_ROOMS}" ontouchstart="">\\s*<img [^>]*alt="Play">\\s*</a>\\s*</div>`));

        const [shared, landscape, portrait] = styleDictionary.split(/@media \(orientation: (?:landscape|portrait)\) \{/);
        const groupStyle = (styles: string) => styles.match(/\n\.imageButtonGroup \{([^}]*)\}/)?.[1] ?? "";
        assert.ok(groupStyle(landscape).includes("flex-direction: row;"));
        assert.ok(groupStyle(portrait).includes("flex-direction: column;"));
        // Together no wider than a paragraph of running text, whose measure the same rule sets.
        assert.match(shared, /\.fullscreenPanel > p,[^{]*\.imageButtonGroup \{\s*max-width: 72ch;/);
    });

    it("builds the whole site from the sources in public/, with every topic feed's posts among them", async () => {
        // Checked, not written: what public/ holds is the build's to change, not a test's.
        FileUtil.configure({checkOnly: true});
        await SSG();
        const postLists = Object.values(LibraryData.entriesByCategory).flat().length;
        assert.ok(FileUtil.getFileCount() > postLists * 2 + ArcadeData.gameEntries.length + Object.keys(FeedTopicData).length);
    });
});

describe("an arcade game's page", () => {
    const entry = {dirName: "Some-Game", title: "Some Game", playLinkURL: "https://example.com/play", lastmod: "2026-01-02"};

    it("is made from its source: a description, keywords, titles, pictures and paragraphs", async () => {
        const dir = makeSite(entry.dirName, [
            ":d:A game about <things> & such.",
            ":k:Free Game, Browser-Game",
            "First line, with a {%a href=\"https://example.com\"%}link{%/a%} and a <tag>.",
            "Second line of the same paragraph.",
            "",
            "<1>",
            "[A Title]",
            "<2>",
        ].join("\n"));
        const {sitemap, feed, sitemapBuilder, atomFeedBuilder} = makeIndexes();

        await new ArcadeGamePageBuilder(sitemapBuilder, atomFeedBuilder).build(entry);

        const page = fs.readFileSync(path.join(dir, entry.dirName, "page.html"), "utf8");
        assert.ok(page.includes(`<title>ThingsPool - ${entry.title}</title>`));
        assert.ok(page.includes(`<meta name="description" content="A game about &lt;things&gt; &amp; such.">`));
        assert.ok(page.includes(`<meta name="keywords" content="free game, browser game">`));
        assert.ok(page.includes(`<h1>${entry.title}</h1>`));
        // The Play button leads there in the tab the page is in.
        assert.ok(page.includes(`<a class="noTextDeco imageButton" href="${entry.playLinkURL}" ontouchstart="">`));
        assert.ok(page.includes(`src="${URL_STATIC}/play.png"`));
        assert.ok(page.includes(`<p>First line, with a <a href="https://example.com">link</a> and a &lt;tag&gt;.<br>Second line of the same paragraph.</p>`));
        assert.ok(page.includes(`<img class="l_image" src="${URL_STATIC}/${entry.dirName}/1.jpg" alt="ThingsPool - ${entry.title} (Screenshot 1)">`));
        assert.ok(page.includes(`<h2>A Title</h2>`));
        assert.ok(page.includes(`alt="ThingsPool - ${entry.title} (Screenshot 2)"`));
        // Previewed with the site's own picture, since the game names none.
        assert.ok(page.includes(`<meta property="og:image" content="${URL_STATIC}/share.jpg"/>`));

        const relativeURL = `${entry.dirName}/page.html`;
        assert.deepEqual(sitemap, [[relativeURL, entry.lastmod]]);
        assert.deepEqual(feed, [{url: `${URL_STATIC}/${relativeURL}`, title: entry.title, lastmod: entry.lastmod,
            description: "A game about <things> & such."}]);
    });

    it("shows a store's badge, a video and a picture of its own to preview it with, where its entry names them", async () => {
        const withExtras = {...entry, playLinkImagePathOverride: "badge.png", videoTag: `<iframe src="https://example.com/video"></iframe>`,
            shareImage: {path: "share_game.jpg", width: 1200, height: 630, alt: "The game, being played."}};
        const dir = makeSite(entry.dirName, ":d:A game.\n:k:Game\nText.");
        const {sitemapBuilder, atomFeedBuilder} = makeIndexes();

        await new ArcadeGamePageBuilder(sitemapBuilder, atomFeedBuilder).build(withExtras);

        const page = fs.readFileSync(path.join(dir, entry.dirName, "page.html"), "utf8");
        assert.ok(page.includes(`<a class="noTextDeco" href="${entry.playLinkURL}">`));
        assert.ok(page.includes(`src="${URL_STATIC}/badge.png"`));
        assert.ok(page.includes(withExtras.videoTag));
        assert.ok(page.includes(`<meta property="og:image" content="${URL_STATIC}/share_game.jpg"/>`));
        assert.ok(page.includes(`<meta property="og:image:alt" content="The game, being played.">`));
        assert.ok(page.includes(`<meta name="twitter:card" content="summary_large_image">`));
    });

    it("is not built without its source", async () => {
        makeSite("Another-Game", "");
        const {sitemap, feed, sitemapBuilder, atomFeedBuilder} = makeIndexes();

        await assert.rejects(new ArcadeGamePageBuilder(sitemapBuilder, atomFeedBuilder).build(entry),
            new RegExp(`${entry.dirName}/${SOURCE_FILE_NAME.replace(".", "\\.")} is missing`));
        assert.deepEqual([sitemap, feed], [[], []]);
    });
});

describe("a library list's posts", () => {
    const entry = {dirName: "some-list", title: "Some List (2026)"};
    const SOURCE = [
        ":d:The first post's description.",
        ":k:Alpha, Beta-Gamma",
        ":l:2026-01-02",
        "",
        "[The \"First\" Post] January 2, 2026",
        "",
        "A line with a <tag> and a {%b%}bold{%/b%} word.",
        "Second line of the same paragraph.",
        "",
        "<001>",
        "<002>*",
        "@@<h3>A line of HTML</h3>",
        "#$",
        "  if (a < b)",
        "      return;",
        "#$",
        "#\"",
        "An excerpt,",
        "  kept as it is laid out.",
        "#\"",
        "",
        ":d:The second post's description.",
        ":k:Delta",
        ":l:2026-02-03",
        "",
        "[The Second Post] February 3, 2026",
        "",
        "Text of the second.",
        ":stop:",
        "",
        "[A Post Not Yet Out] March 4, 2026",
        "",
        "Text nobody reads yet.",
    ].join("\n");

    it("are made from its source, a page for each title, up to the stop sign", async () => {
        const dir = makeSite(entry.dirName, SOURCE);
        const {sitemap, feed, sitemapBuilder, atomFeedBuilder} = makeIndexes();

        const postInfoList = await new LibraryPostPageBuilder(sitemapBuilder, atomFeedBuilder).build(entry);

        const pictureURL = (name: string) => `${URL_STATIC}/${entry.dirName}/${name}.jpg`;
        assert.deepEqual(postInfoList, [
            {pageNumber: 1, title: "The \"First\" Post", lastmod: "2026-01-02", desc: "The first post's description.",
                keywords: "alpha, beta gamma", customOGImagePath: pictureURL("002")},
            // No picture of its own, so it is previewed with the site's.
            {pageNumber: 2, title: "The Second Post", lastmod: "2026-02-03", desc: "The second post's description.",
                keywords: "delta", customOGImagePath: undefined},
        ]);
        assert.deepEqual(fs.readdirSync(path.join(dir, entry.dirName)).sort(), ["page-1.html", "page-2.html", SOURCE_FILE_NAME]);

        const first = fs.readFileSync(path.join(dir, entry.dirName, "page-1.html"), "utf8");
        assert.ok(first.includes(`<title>The &#34;First&#34; Post</title>`));
        assert.ok(first.includes(`<meta name="description" content="The first post&#39;s description.">`));
        assert.ok(first.includes(`<meta name="keywords" content="alpha, beta gamma">`));
        assert.ok(first.includes(`<meta property="og:type" content="article"/>`));
        assert.ok(first.includes(`<meta property="og:image" content="${pictureURL("002")}"/>`));
        assert.ok(first.includes(`<h1>The "First" Post</h1>`));
        assert.ok(first.includes(`Youngjin Kang</a>&nbsp;&nbsp;&nbsp;Date: January 2, 2026</p>`));
        assert.ok(first.includes(`<p>A line with a &lt;tag&gt; and a <b>bold</b> word.<br>Second line of the same paragraph.</p>`));
        assert.ok(first.includes(`<img class="l_image" src="${pictureURL("001")}" alt="The &quot;First&quot; Post (Figure 1)">`));
        assert.ok(first.includes(`alt="The &quot;First&quot; Post (Figure 2)"`));
        assert.ok(first.includes(`<h3>A line of HTML</h3>`));
        assert.ok(first.includes(`<div class="snippet"><pre><code>  if (a &lt; b)\n      return;</code></pre></div>`));
        assert.ok(first.includes(`<pre><div class="excerpt">An excerpt,\n  kept as it is laid out.</div></pre>`));
        assert.ok(first.includes(`href="${URL_STATIC}/${entry.dirName}/page-2.html">Next Page</a>`));
        assert.ok(!first.includes("Previous Page"));

        const second = fs.readFileSync(path.join(dir, entry.dirName, "page-2.html"), "utf8");
        assert.ok(second.includes(`<h1>The Second Post</h1>`));
        assert.ok(second.includes(`<p>Text of the second.</p>`));
        assert.ok(second.includes(`href="${URL_STATIC}/${entry.dirName}/page-1.html">Previous Page</a>`));
        assert.ok(!second.includes("Next Page"));
        assert.ok(!second.includes("Not Yet Out"));
        assert.ok(second.includes(`<meta property="og:image" content="${URL_STATIC}/share.jpg"/>`));

        assert.deepEqual(sitemap, [[`${entry.dirName}/page-1.html`, "2026-01-02"], [`${entry.dirName}/page-2.html`, "2026-02-03"]]);
        assert.deepEqual(feed, [
            {url: `${URL_STATIC}/${entry.dirName}/page-1.html`, title: "The \"First\" Post", lastmod: "2026-01-02",
                description: "The first post's description."},
            {url: `${URL_STATIC}/${entry.dirName}/page-2.html`, title: "The Second Post", lastmod: "2026-02-03",
                description: "The second post's description."},
        ]);
    });

    it("take the site's oldest date where the source gives none, and another author's name where the list has one", async () => {
        const dir = makeSite(entry.dirName, "[An Undated Post] Some day\n\nText.");
        const {sitemap, sitemapBuilder, atomFeedBuilder} = makeIndexes();

        await new LibraryPostPageBuilder(sitemapBuilder, atomFeedBuilder).build({...entry, author: "Somebody Else"});

        assert.deepEqual(sitemap, [[`${entry.dirName}/page-1.html`, GLOBAL_LAST_MOD]]);
        const page = fs.readFileSync(path.join(dir, entry.dirName, "page-1.html"), "utf8");
        assert.ok(page.includes(`<p class="dim">Author: Somebody Else&nbsp;&nbsp;&nbsp;Date: Some day</p>`));
    });
});

describe("a build", () => {
    it("writes a file only when its content changed, and a check writes nothing", async () => {
        const dir = makeSite("a-folder", "");
        const filePath = path.join(dir, "a-folder/page.html");

        await FileUtil.write("a-folder/page.html", "first");
        assert.equal(fs.readFileSync(filePath, "utf8"), "first");
        assert.deepEqual([FileUtil.getFileCount(), FileUtil.getChangedFiles()], [1, ["a-folder/page.html"]]);

        FileUtil.configure({rootDir: dir});
        const writtenAt = fs.statSync(filePath).mtimeMs;
        await FileUtil.write("a-folder/page.html", "first");
        assert.equal(fs.statSync(filePath).mtimeMs, writtenAt);
        assert.deepEqual([FileUtil.getFileCount(), FileUtil.getChangedFiles()], [1, []]);

        FileUtil.configure({rootDir: dir, checkOnly: true});
        await FileUtil.write("a-folder/page.html", "second");
        await FileUtil.write("a-folder/new.html", "new");
        assert.equal(fs.readFileSync(filePath, "utf8"), "first");
        assert.ok(!fs.existsSync(path.join(dir, "a-folder/new.html")));
        assert.deepEqual([FileUtil.getFileCount(), FileUtil.getChangedFiles()], [2, ["a-folder/page.html", "a-folder/new.html"]]);
    });
});
