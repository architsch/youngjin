/**
 * Character-budget check for dev-log posts (driven by the `devlog-post` Claude skill).
 *
 * A dev-log post is written to be pasted into a social post as it stands, with a short "Play Here"
 * line added underneath by hand. LinkedIn is the tightest of the places it goes, so its ceiling is
 * the one that governs, minus the room that trailing line needs.
 *
 * What gets counted is what a reader would select on the page and copy: the title, then the body
 * paragraphs and hashtags — not the source file's own directives, image references or raw HTML,
 * and not the byline, which the page adds and nobody pastes.
 *
 * Usage:
 *   node dev/scripts/devlog/postLength.js                 (the newest post)
 *   node dev/scripts/devlog/postLength.js --all           (every post in the file)
 *   node dev/scripts/devlog/postLength.js --source=public/devlog-2031/source.txt
 *
 * With no --source it reads the current dev-log year's file; see devlogDir.js for which year that
 * is and why it can still be last year's.
 */
const fs = require("fs");
const path = require("path");
const { resolveDevlogDir } = require("./devlogDir");

const REPO_ROOT = path.resolve(__dirname, "../../..");

// Hashtags are how a post reaches anyone who was not already looking for it, but each one is spent
// from the budget below, and a long line reads as spam to the person scrolling past it. The bank
// they are drawn from lives in the skill's reference/hashtags.md.
const MIN_HASHTAGS = 12;
const MAX_HASHTAGS = 18;

const LINKEDIN_LIMIT = 3000;
// "Play Here: https://thingspool.net" (33) plus the blank line separating it from the post (3).
const RESERVED_FOR_PLAY_LINE = 36;
const BUDGET = LINKEDIN_LIMIT - RESERVED_FOR_PLAY_LINE;

// What a post should actually come out at, as against what it is allowed to reach. The three posts
// the user wrote by hand run 620, 550 and 510 characters of body text — title and hashtags aside —
// and they are the house length. The budget above is a platform limit, and a post anywhere near it
// has stopped being an advertisement and become a report. The band is deliberately wide: it is
// there to catch a draft that has drifted into essay length, not to police a good post by ten
// characters.
const PROSE_TARGET = 600;
const PROSE_MAX = 1000;
const PROSE_MIN = 250;

function main()
{
    const args = process.argv.slice(2);
    const all = args.includes("--all");
    const sourceArg = args.find(a => a.startsWith("--source="));
    const devlog = resolveDevlogDir();
    const sourcePath = path.resolve(REPO_ROOT,
        sourceArg ? sourceArg.slice("--source=".length) : devlog.source);

    // Worth saying out loud rather than silently measuring the wrong year's posts.
    if (!sourceArg && !devlog.isCurrentYear)
        console.log(`Note: ${devlog.currentYear} has no dev-log directory yet, so this is ${devlog.year}'s.\n`);

    if (!fs.existsSync(sourcePath))
    {
        console.error(`No source file at ${path.relative(REPO_ROOT, sourcePath)}`);
        process.exit(1);
    }

    const posts = parsePosts(fs.readFileSync(sourcePath, "utf8"));
    if (posts.length == 0)
    {
        console.error(`No posts found in ${path.relative(REPO_ROOT, sourcePath)} (a post opens with a "[Title] Date" line).`);
        process.exit(1);
    }

    const checked = all ? posts : [posts[posts.length - 1]];
    let failed = false;

    for (const post of checked)
    {
        const text = renderSocialText(post);
        const over = text.length > BUDGET;
        failed = failed || over;

        console.log(`${over ? "FAIL" : "PASS"}  page-${post.pageNumber}  "${post.title}"`);
        console.log(`      ${text.length} / ${BUDGET} characters (${over ? `${text.length - BUDGET} over` : `${BUDGET - text.length} left`})`);

        // The hashtags are counted above like any other text, so it is worth seeing what they cost.
        const tagLine = hashtagLine(post);
        if (tagLine.length > 0)
            console.log(`      ${hashtagsIn(tagLine).length} hashtags, ${tagLine.length} of those characters`);

        // The number that actually says whether the post is the right size.
        console.log(`      ${proseLength(post)} characters of prose (house length is about ${PROSE_TARGET})`);

        for (const warning of lint(post))
            console.log(`      ! ${warning}`);
    }

    console.log(`\nBudget: LinkedIn's ${LINKEDIN_LIMIT}-character limit less ${RESERVED_FOR_PLAY_LINE} reserved for the "Play Here" line.`);
    process.exit(failed ? 1 : 0);
}

/**
 * Splits the source into posts, one per "[Title] Date" header, in file order (newest last).
 * A post's :d: / :k: / :l: directives sit above its header, so they are held aside as they are
 * read and handed to the post they introduce.
 */
function parsePosts(raw)
{
    const posts = [];
    let current = null;
    let pendingMeta = [];

    for (const line of raw.split(/\r?\n/))
    {
        const trimmed = line.trim();
        const header = trimmed.match(/^\[(.*?)\](.*)$/);

        if (header)
        {
            current = {
                pageNumber: posts.length + 1,
                title: header[1].trim(),
                date: header[2].trim(),
                meta: pendingMeta,
                lines: [],
            };
            pendingMeta = [];
            posts.push(current);
        }
        else if (isDirective(trimmed))
        {
            pendingMeta.push(trimmed);
        }
        else if (current)
        {
            current.lines.push(line);
        }
    }
    return posts;
}

/** The post as a reader would copy it: title, blank line, then the prose and hashtags. */
function renderSocialText(post)
{
    const body = [];
    for (const raw of post.lines)
    {
        const line = raw.trim();
        if (line.length == 0)
        {
            if (body.length > 0 && body[body.length - 1] != "")
                body.push("");
            continue;
        }
        if (isDirective(line) || isImageRef(line) || isRawHTML(line) || isBlockToggle(line))
            continue;
        // `{%` / `%}` stand in for angle brackets, which the page renders as one character each.
        body.push(line.replaceAll("{%", "<").replaceAll("%}", ">"));
    }
    while (body.length > 0 && body[body.length - 1] == "")
        body.pop();

    return `${post.title}\n\n${body.join("\n")}`;
}

/**
 * The body text alone: what renderSocialText counts, less the title and the trailing hashtag line.
 * This is the number the house length is stated in, since the title and the tags are fixed costs
 * that say nothing about whether the post itself is the right size.
 */
function proseLength(post)
{
    const withoutTitle = renderSocialText(post).slice(`${post.title}\n\n`.length);
    const tagLine = hashtagLine(post);
    const prose = tagLine.length > 0
        ? withoutTitle.slice(0, withoutTitle.lastIndexOf(tagLine))
        : withoutTitle;
    return prose.trim().length;
}

/** Notes on anything the post format would quietly turn into something other than prose. */
function lint(post)
{
    const warnings = [];
    const text = post.lines.join("\n");

    for (const directive of [":d:", ":k:", ":l:"])
    {
        if (!post.meta.some(line => line.startsWith(directive)))
            warnings.push(`No ${directive} line above this post's header.`);
    }
    const hashtags = hashtagsIn(hashtagLine(post));
    if (hashtags.length == 0)
        warnings.push("No hashtags found — every post ends on one line of PascalCase ones.");
    else if (hashtags.length < MIN_HASHTAGS)
        warnings.push(`Only ${hashtags.length} hashtags — a post carries about 16, part broad and part about itself. See the skill's reference/hashtags.md.`);
    else if (hashtags.length > MAX_HASHTAGS)
        warnings.push(`${hashtags.length} hashtags — past ${MAX_HASHTAGS} the line is eating the prose's characters and reads as spam rather than as reach.`);
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text))
        warnings.push("Contains emoji, which these posts do without.");

    const prose = proseLength(post);
    if (prose > PROSE_MAX)
        warnings.push(`${prose} characters of prose — the house length is about ${PROSE_TARGET}. The ceiling above is a platform limit, not a target; cut this back rather than filling the budget.`);
    else if (prose < PROSE_MIN && prose > 0)
        warnings.push(`Only ${prose} characters of prose — too thin to say what the feature is and invite anyone in.`);

    if (!post.lines.some(raw => isIntroLink(raw.trim())))
        warnings.push(`No link to the landing page — every post opens with:  ${INTRO_LINK_LINE}`);
    for (const raw of post.lines)
    {
        const line = raw.trim();
        if (isIntroLink(line))
            continue;
        if (isRawHTML(line) || isBlockToggle(line))
            warnings.push(`Line uses post-format markup that a pasted post would lose: "${line.slice(0, 40)}"`);
    }
    return warnings;
}

// Every post opens with a link to the site's landing page, so a reader who arrives at one post
// first can find out what the game is before reading about a piece of it.
// The href is the live site's own, as the other library posts write their internal links: the SSG
// rewrites it to the local address when the dev server serves the page.
const INTRO_PAGE_HREF = "https://thingspool.net#what-is-thingspool";
const INTRO_LINK_LINE = `@@<h3>New here? Start with <a class="inlineButton" href="${INTRO_PAGE_HREF}">What is ThingsPool?</a></h3>`;

const isIntroLink = (line) => isRawHTML(line) && line.includes(`href="${INTRO_PAGE_HREF}"`);

/** The post's trailing hashtag line, or "" if the post does not end on one. */
function hashtagLine(post)
{
    for (let i = post.lines.length - 1; i >= 0; i--)
    {
        const line = post.lines[i].trim();
        if (line.length == 0)
            continue;
        return /^#[A-Za-z][A-Za-z0-9]*( +#[A-Za-z][A-Za-z0-9]*)*$/.test(line) ? line : "";
    }
    return "";
}

const hashtagsIn = (line) => line.match(/#[A-Za-z][A-Za-z0-9]*/g) || [];

const isDirective = (line) => /^:[dkl]:/.test(line);
const isImageRef = (line) => line.startsWith("<");
const isRawHTML = (line) => line.startsWith("@@");
const isBlockToggle = (line) => line.startsWith("#$") || line.startsWith('#"');

main();
