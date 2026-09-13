/**
 * Character-budget check for dev-log posts (driven by the `devlog-post` skill). The budget is LinkedIn's
 * limit minus a hand-added "Play Here" line. Counts what a reader would copy: the title, body paragraphs
 * and hashtags (not directives, image references, raw HTML or the byline).
 *
 * Usage:
 *   node dev/scripts/devlog/postLength.js                 (the newest post)
 *   node dev/scripts/devlog/postLength.js --all           (every post in the file)
 *   node dev/scripts/devlog/postLength.js --source=public/devlog-2031/source.txt
 *
 * Without --source it reads the current dev-log year's file (see devlogDir.js).
 */
const fs = require("fs");
const path = require("path");
const { resolveDevlogDir } = require("./devlogDir");

const REPO_ROOT = path.resolve(__dirname, "../../..");

// Each hashtag spends budget; the bank lives in the skill's reference/hashtags.md.
const MIN_HASHTAGS = 12;
const MAX_HASHTAGS = 18;

const LINKEDIN_LIMIT = 3000;
// "Play Here: https://thingspool.net" (33) plus the blank line separating it from the post (3).
const RESERVED_FOR_PLAY_LINE = 36;
const BUDGET = LINKEDIN_LIMIT - RESERVED_FOR_PLAY_LINE;

// The house body length (hand-written posts run about 510-620 chars), as opposed to the platform limit
// above. The band is wide: it catches essay-length drafts, not small overruns.
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
 * Splits the source into posts at each "[Title] Date" header (newest last). The :d: / :k: / :l:
 * directives above a header belong to that post.
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

/** Body text only (renderSocialText minus the title and hashtag line), the measure the house length uses. */
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

// Every post opens with a link to the landing page. The live href is rewritten by the SSG for local dev.
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
