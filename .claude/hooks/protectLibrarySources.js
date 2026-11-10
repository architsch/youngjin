#!/usr/bin/env node
/**
 * PreToolUse guard for the author's page sources.
 *
 * Every library and arcade page under `public/` is built from the `source.txt` beside it,
 * which is the author's own text. Claude never edits, overwrites, moves or deletes one. This
 * hook denies a file tool aimed at one, and a Bash command that would change or remove one:
 * a mutating verb whose operands name one, a folder holding one or a glob matching one; a
 * redirection or `tee` into one; an inline script that names one; or a git command that would
 * throw away uncommitted changes to one. Reading stays allowed.
 *
 * It only ever says "deny"; everything else gets no decision. Its deny outranks the allow that
 * autoApproveBash.js gives local commands. Run
 * `node .claude/hooks/protectLibrarySources.js --self-test` after editing.
 */

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const WORKSPACE = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const PROTECTED_PATTERN = /(^|\/)public\/(?:[^/]+\/)+source\.txt$/i;
const NAME_PATTERN = /source\.txt/i;
const REASON =
    "The source.txt files under public/ are the author's own text, from which his pages are built. " +
    "Claude never edits, overwrites, moves or deletes one: read it with the Read tool, and leave any " +
    "change to him. (.claude/hooks/protectLibrarySources.js)";

const FILE_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const REMOVERS = new Set(["rm", "rmdir", "unlink", "shred", "truncate", "touch", "srm", "trash"]);
const COPIERS = new Set(["cp", "gcp", "install", "rsync", "ln", "ditto"]);
const EDITORS = new Set(["ed", "ex", "vi", "vim", "nvim", "nano", "emacs", "pico", "patch"]);
const INTERPRETERS = new Set([
    "node", "python", "python3", "perl", "ruby", "deno", "bun", "tsx", "ts-node",
    "sh", "bash", "zsh", "dash", "fish", "osascript", "php", "lua", "eval",
]);
const WRAPPERS = new Set([
    "sudo", "doas", "env", "time", "nohup", "command", "builtin", "exec", "nice", "stdbuf",
    "caffeinate", "timeout", "gtimeout", "xargs", "parallel", "!",
]);
const KEYWORDS = new Set([
    "if", "then", "else", "elif", "fi", "while", "until", "do", "done", "for", "in", "case",
    "esac", "{", "}", "function", "select",
]);
const FIND_MUTATORS = new Set(["-delete", "-exec", "-execdir", "-ok", "-okdir"]);
const GIT_GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace"]);

// ---------------------------------------------------------------------------
// What is protected
// ---------------------------------------------------------------------------

let protectedFiles = null;

function listProtected() {
    if (protectedFiles) return protectedFiles;
    protectedFiles = [];
    const walk = (dir, depth) => {
        if (depth > 6) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(full, depth + 1);
            } else if (entry.name.toLowerCase() === "source.txt") {
                protectedFiles.push(full);
            }
        }
    };
    walk(path.join(WORKSPACE, "public"), 0);
    return protectedFiles;
}

const lower = (p) => p.toLowerCase();

function isProtectedPath(abs) {
    return PROTECTED_PATTERN.test(abs.split(path.sep).join("/"));
}

function holdsProtected(absDir) {
    const prefix = lower(absDir.endsWith("/") ? absDir : absDir + "/");
    return listProtected().some((file) => lower(file).startsWith(prefix));
}

function escapeRegex(text) {
    return text.replace(/[.+^$()|\\/]/g, "\\$&");
}

function globToRegex(glob) {
    let re = "";
    for (let i = 0; i < glob.length; i++) {
        const ch = glob[i];
        if (ch === "*") {
            if (glob[i + 1] === "*") {
                re += ".*";
                i++;
            } else {
                re += "[^/]*";
            }
        } else if (ch === "?") {
            re += "[^/]";
        } else if (ch === "[" && glob.indexOf("]", i + 1) > i) {
            const end = glob.indexOf("]", i + 1);
            let cls = glob.slice(i + 1, end);
            if (cls.startsWith("!")) cls = "^" + cls.slice(1);
            re += "[" + cls.replace(/\\/g, "\\\\") + "]";
            i = end;
        } else if (ch === "{" && glob.indexOf("}", i + 1) > i) {
            const end = glob.indexOf("}", i + 1);
            re += "(" + glob.slice(i + 1, end).split(",").map(escapeRegex).join("|") + ")";
            i = end;
        } else {
            re += escapeRegex(ch);
        }
    }
    return new RegExp("^" + re + "$", "i");
}

/** "file" when the glob matches a protected file, "dir" when it matches a folder holding one. */
function globHit(absGlob) {
    let re;
    try {
        re = globToRegex(absGlob);
    } catch {
        return null;
    }
    let dirHit = false;
    for (const file of listProtected()) {
        if (re.test(file)) return "file";
        for (let dir = path.dirname(file); ; dir = path.dirname(dir)) {
            if (re.test(dir)) dirHit = true;
            if (dir === path.dirname(dir)) break;
        }
    }
    return dirHit ? "dir" : null;
}

function resolvePath(word, cwd) {
    let p = word;
    if (p === "~" || p.startsWith("~/")) p = path.join(os.homedir(), p.slice(1));
    return path.resolve(cwd, p);
}

/**
 * How a word reaches protected files: "name" (it names source.txt), "file" (it is one),
 * "dir" (a folder holding one) or "glob" (a pattern matching one). Null when it reaches none.
 */
function classify(word, cwd) {
    if (!word) return null;
    const candidates = [word];
    const eq = word.indexOf("=");
    if (eq >= 0) candidates.push(word.slice(eq + 1));
    if (/\s/.test(word)) candidates.push(...word.split(/\s+/).filter(Boolean));
    for (const candidate of candidates) {
        if (NAME_PATTERN.test(candidate)) return "name";
        if (candidate.startsWith("-") || /[$`]/.test(candidate)) continue;
        const abs = resolvePath(candidate, cwd);
        if (isProtectedPath(abs)) return "file";
        if (/[*?[{]/.test(candidate)) {
            const hit = globHit(abs);
            if (hit === "file") return "glob";
            if (hit === "dir") return "dir";
        } else if (holdsProtected(abs)) {
            return "dir";
        }
    }
    return null;
}

/** True when copying `source` into a folder could bring a file named source.txt with it. */
function carriesName(source, cwd) {
    if (NAME_PATTERN.test(source)) return true;
    if (/[*?[{]/.test(source)) return true;
    const abs = resolvePath(source, cwd);
    let found = false;
    const walk = (dir, depth) => {
        if (found || depth > 4) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name.toLowerCase() === "source.txt") found = true;
            else if (entry.isDirectory()) walk(path.join(dir, entry.name), depth + 1);
        }
    };
    walk(abs, 0);
    return found;
}

let dirtyOverride = null;

/** Protected files git reports as changed (or, with `untrackedOnly`, as new). */
function dirtyProtected(untrackedOnly) {
    if (dirtyOverride) return dirtyOverride.filter((line) => !untrackedOnly || line.startsWith("??"));
    try {
        const out = execFileSync(
            "git",
            ["-C", WORKSPACE, "status", "--porcelain", "--untracked-files=all", "--", ":(glob)public/**/source.txt"],
            { encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] },
        );
        return out.split("\n").filter(Boolean).filter((line) => !untrackedOnly || line.startsWith("??"));
    } catch {
        return ["(git status failed)"];
    }
}

// ---------------------------------------------------------------------------
// Reading a command
// ---------------------------------------------------------------------------

/** Takes heredoc bodies out of the command text, returning them separately. */
function stripHeredocs(command) {
    const lines = command.split("\n");
    const kept = [];
    const bodies = [];
    for (let i = 0; i < lines.length; i++) {
        kept.push(lines[i]);
        const delimiters = [];
        const re = /<<(-?)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/g;
        let m;
        while ((m = re.exec(lines[i])) !== null) {
            if (lines[i][m.index + 2] === "<") continue;
            delimiters.push({ tabs: m[1] === "-", word: m[3] });
        }
        for (const { tabs, word } of delimiters) {
            const body = [];
            i++;
            while (i < lines.length && (tabs ? lines[i].replace(/^\t+/, "") : lines[i]) !== word) {
                body.push(lines[i]);
                i++;
            }
            bodies.push(body.join("\n"));
        }
    }
    return { text: kept.join("\n"), bodies };
}

/** Returns the inside of each `$(...)` and backtick substitution, and the text with each opened up. */
function openSubstitutions(text) {
    const inners = [];
    let out = "";
    let i = 0;
    let quote = null;
    while (i < text.length) {
        const ch = text[i];
        if (quote === "'") {
            out += ch;
            if (ch === "'") quote = null;
            i++;
            continue;
        }
        if (ch === "'" && !quote) {
            quote = "'";
            out += ch;
            i++;
            continue;
        }
        if (ch === '"') quote = quote === '"' ? null : '"';
        if (ch === "$" && text[i + 1] === "(" && text[i + 2] !== "(") {
            let depth = 1;
            let j = i + 2;
            while (j < text.length && depth > 0) {
                if (text[j] === "(") depth++;
                else if (text[j] === ")") depth--;
                j++;
            }
            const inner = text.slice(i + 2, depth === 0 ? j - 1 : j);
            inners.push(inner);
            out += " " + inner + " ";
            i = j;
            continue;
        }
        if (ch === "`") {
            const end = text.indexOf("`", i + 1);
            const inner = text.slice(i + 1, end < 0 ? text.length : end);
            inners.push(inner);
            out += " " + inner + " ";
            i = end < 0 ? text.length : end + 1;
            continue;
        }
        out += ch;
        i++;
    }
    return { text: out, inners };
}

/** Words, operators ("op") and redirections ("redir"), with quoting removed. */
function tokenize(text) {
    const tokens = [];
    let word = null;
    const flush = () => {
        if (word !== null) tokens.push({ type: "word", value: word });
        word = null;
    };
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === "'") {
            const end = text.indexOf("'", i + 1);
            word = (word ?? "") + text.slice(i + 1, end < 0 ? text.length : end);
            i = end < 0 ? text.length : end + 1;
            continue;
        }
        if (ch === '"') {
            let j = i + 1;
            let buf = "";
            while (j < text.length && text[j] !== '"') {
                if (text[j] === "\\" && j + 1 < text.length) {
                    buf += text[j + 1];
                    j += 2;
                } else {
                    buf += text[j];
                    j++;
                }
            }
            word = (word ?? "") + buf;
            i = j + 1;
            continue;
        }
        if (ch === "\\") {
            if (i + 1 < text.length && text[i + 1] !== "\n") word = (word ?? "") + text[i + 1];
            i += 2;
            continue;
        }
        if (ch === " " || ch === "\t") {
            flush();
            i++;
            continue;
        }
        if (ch === "\n") {
            flush();
            tokens.push({ type: "op", value: ";" });
            i++;
            continue;
        }
        if (ch === "#" && word === null) {
            const end = text.indexOf("\n", i);
            i = end < 0 ? text.length : end;
            continue;
        }
        const rest = text.slice(i);
        let m = rest.match(/^(&&|\|\||\|&|;;|[;|()])/);
        if (m) {
            flush();
            tokens.push({ type: "op", value: m[1] });
            i += m[1].length;
            continue;
        }
        m = rest.match(/^(&>>|&>|>>|>\||>&|<<<|<<-|<<|<>|<&|>|<)/);
        if (m) {
            let fd = "";
            if (word !== null && /^\d+$/.test(word)) {
                fd = word;
                word = null;
            }
            flush();
            tokens.push({ type: "redir", value: fd + m[1] });
            i += m[1].length;
            continue;
        }
        if (ch === "&") {
            flush();
            tokens.push({ type: "op", value: "&" });
            i++;
            continue;
        }
        word = (word ?? "") + ch;
        i++;
    }
    flush();
    return tokens;
}

function splitSegments(tokens) {
    const segments = [];
    let current = [];
    for (const token of tokens) {
        if (token.type === "op") {
            if (current.length) segments.push(current);
            current = [];
        } else {
            current.push(token);
        }
    }
    if (current.length) segments.push(current);
    return segments;
}

function expandVars(word, vars) {
    return word.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (all, a, b) => {
        const name = a || b;
        if (name === "HOME") return os.homedir();
        return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : all;
    });
}

/** Index of the command word after assignments, keywords and wrappers, and whether xargs feeds it. */
function findHead(words) {
    let k = 0;
    let fed = false;
    while (k < words.length) {
        const w = words[k];
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || KEYWORDS.has(w)) {
            k++;
            continue;
        }
        const base = path.basename(w);
        if (!WRAPPERS.has(base)) return { k, fed };
        if (base === "xargs" || base === "parallel") fed = true;
        k++;
        while (k < words.length && (words[k].startsWith("-") || /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[k]))) {
            const option = words[k];
            k++;
            if (/^-[nIPLdEsJRu]$/.test(option) && k < words.length) k++;
        }
        if ((base === "timeout" || base === "gtimeout") && k < words.length && /^\d/.test(words[k])) k++;
    }
    return { k: -1, fed };
}

/** Operands after the options, with `--` ending the options and `--opt=value` giving its value. */
function operandsOf(args) {
    const operands = [];
    let optionsEnded = false;
    for (const arg of args) {
        if (!optionsEnded && arg === "--") {
            optionsEnded = true;
            continue;
        }
        if (!optionsEnded && arg.startsWith("-") && arg.length > 1) {
            const eq = arg.indexOf("=");
            if (eq > 0) operands.push(arg.slice(eq + 1));
            continue;
        }
        operands.push(arg);
    }
    return operands;
}

// ---------------------------------------------------------------------------
// Deciding
// ---------------------------------------------------------------------------

const FILE_LEVEL = new Set(["name", "file", "glob"]);

function checkGit(args, cwd) {
    let k = 0;
    let gitCwd = cwd;
    while (k < args.length && args[k].startsWith("-")) {
        const option = args[k];
        k++;
        if (GIT_GLOBAL_WITH_VALUE.has(option) && k < args.length) {
            if (option === "-C") gitCwd = resolvePath(args[k], cwd);
            k++;
        }
    }
    const sub = args[k];
    const rest = args.slice(k + 1);
    const operands = operandsOf(rest);
    const kinds = operands.map((o) => classify(o, gitCwd));
    if (sub === "rm" || sub === "mv") return kinds.some(Boolean);
    if (sub === "checkout" || sub === "restore") {
        if (sub === "restore" && rest.includes("--staged") && !rest.includes("--worktree") && !rest.includes("-W")) return false;
        if (kinds.some((kind) => FILE_LEVEL.has(kind))) return true;
        const force = rest.some((a) => a === "-f" || a === "--force" || a === "--discard-changes");
        if (kinds.includes("dir") || force) return dirtyProtected(false).length > 0;
        return false;
    }
    if (sub === "switch") {
        const force = rest.some((a) => a === "-f" || a === "--force" || a === "--discard-changes");
        return force && dirtyProtected(false).length > 0;
    }
    if (sub === "reset") {
        const discards = rest.some((a) => a === "--hard" || a === "--merge" || a === "--keep");
        return discards && dirtyProtected(false).length > 0;
    }
    if (sub === "stash") {
        const action = rest.find((a) => !a.startsWith("-"));
        if (action && !["push", "save"].includes(action)) return false;
        return dirtyProtected(false).length > 0;
    }
    if (sub === "clean") {
        const force = rest.some((a) => a === "--force" || /^-[a-zA-Z]*f/.test(a));
        return force && dirtyProtected(true).length > 0;
    }
    if (sub === "apply" || sub === "am") return kinds.some(Boolean);
    return false;
}

/** True when one simple command would write, move or remove a protected file. */
function segmentDenies(head, args, cwd) {
    const operands = operandsOf(args);
    const hit = (word) => classify(word, cwd);

    if (REMOVERS.has(head) || EDITORS.has(head) || head === "tee") return operands.some(hit);
    if (head === "mv") {
        const sources = operands.slice(0, -1);
        const dest = operands[operands.length - 1];
        return sources.some(hit) || FILE_LEVEL.has(hit(dest)) || (operands.length === 1 && Boolean(hit(dest)));
    }
    if (COPIERS.has(head)) {
        const targetOption = args.findIndex((a) => a === "-t" || a.startsWith("--target-directory"));
        let dest;
        let sources;
        if (targetOption >= 0) {
            const option = args[targetOption];
            dest = option.includes("=") ? option.slice(option.indexOf("=") + 1) : args[targetOption + 1];
            sources = operands.filter((o) => o !== dest);
        } else {
            dest = operands[operands.length - 1];
            sources = operands.slice(0, -1);
        }
        const destKind = hit(dest);
        if (FILE_LEVEL.has(destKind)) return true;
        if (destKind === "dir") {
            if (head === "rsync" && args.some((a) => a.startsWith("--delete"))) return true;
            return sources.some((s) => carriesName(s, cwd));
        }
        return false;
    }
    if (head === "sed" || head === "gsed") {
        const inPlace = args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith("--in-place"));
        return inPlace && operands.some(hit);
    }
    if (head === "perl" || head === "ruby") {
        const inPlace = args.some((a) => /^-[a-zA-Z]*i/.test(a));
        return inPlace && operands.some(hit);
    }
    if (head === "awk" || head === "gawk") {
        const inPlace = args.some((a, i) => a === "-iinplace" || a.startsWith("--include=inplace") || ((a === "-i" || a === "--include") && args[i + 1] === "inplace"));
        return inPlace && operands.some(hit);
    }
    if (head === "dd") return args.some((a) => a.startsWith("of=") && hit(a.slice(3)));
    if (head === "find") return args.some((a) => FIND_MUTATORS.has(a)) && args.some(hit);
    if (head === "tar" || head === "bsdtar" || head === "gtar") {
        const extracts = args.some((a, i) => a === "--extract" || a === "--get" ||
            (/^-[a-zA-Z]*x[a-zA-Z]*$/.test(a)) || (i === 0 && /^[a-zA-Z]*x[a-zA-Z]*$/.test(a)));
        return extracts && args.some(hit);
    }
    if (head === "unzip") return args.some(hit);
    if (head === "git") return checkGit(args, cwd);
    return false;
}

// Interpreters are left out: a script's own writes are what pageSourcesShell.sh's sandbox refuses.
const MUTATING_HEADS = new Set([...REMOVERS, ...COPIERS, ...EDITORS, "mv", "tee", "sed", "gsed", "dd", "git"]);

/** Every `NAME=value` the command assigns, so a substitution sees variables set before it. */
function assignmentsOf(text) {
    const vars = {};
    for (const segment of splitSegments(tokenize(text))) {
        const words = segment.filter((t) => t.type === "word").map((t) => t.value);
        const assigning = words[0] === "export" || words[0] === "local" || words[0] === "declare" ? words.slice(1) : words;
        if (!assigning.length || !assigning.every((w) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w))) continue;
        for (const w of assigning) {
            const m = w.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
            vars[m[1]] = expandVars(m[2], vars);
        }
    }
    return vars;
}

function commandDenies(command, cwd, depth = 0, outerVars = {}) {
    if (depth > 4) return NAME_PATTERN.test(command);
    const { text: withoutHeredocs, bodies } = stripHeredocs(command);
    const { text, inners } = openSubstitutions(withoutHeredocs);
    const known = { ...outerVars, ...assignmentsOf(withoutHeredocs.replace(/\$\(|`|\)/g, " ")) };
    for (const inner of inners) {
        if (commandDenies(inner, cwd, depth + 1, known)) return true;
    }
    const namesProtected = NAME_PATTERN.test(command);
    const vars = { ...outerVars };
    let here = cwd;
    let anyHit = false;
    let computedMutation = false;

    for (const segment of splitSegments(tokenize(text))) {
        const words = [];
        const targets = [];
        for (let i = 0; i < segment.length; i++) {
            const token = segment[i];
            if (token.type === "redir") {
                const next = segment[i + 1];
                if (next && next.type === "word") {
                    if (token.value.includes(">") && !/^(\d+|-)$/.test(next.value)) targets.push(expandVars(next.value, vars));
                    i++;
                }
                continue;
            }
            words.push(expandVars(token.value, vars));
        }
        for (const target of targets) {
            if (FILE_LEVEL.has(classify(target, here))) return true;
        }
        if (words.some((w) => classify(w, here))) anyHit = true;

        const { k, fed } = findHead(words);
        if (k < 0) {
            for (const w of words) {
                const m = w.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
                if (m) vars[m[1]] = m[2];
            }
            continue;
        }
        const head = path.basename(words[k]).toLowerCase();
        const args = words.slice(k + 1);
        if (head === "export" || head === "local" || head === "declare") {
            for (const w of args) {
                const m = w.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s);
                if (m) vars[m[1]] = m[2];
            }
            continue;
        }
        if (head === "cd" || head === "pushd") {
            const dest = args.find((a) => !a.startsWith("-"));
            if (dest && !/[$`]/.test(dest)) here = resolvePath(dest, here);
            else if (!dest) here = os.homedir();
            continue;
        }
        if (INTERPRETERS.has(head) && (namesProtected || bodies.some((b) => NAME_PATTERN.test(b)))) return true;
        if (segmentDenies(head, args, here)) return true;
        if (MUTATING_HEADS.has(head) && (fed || args.some((a) => /[$`]/.test(a)))) computedMutation = true;
    }
    // A mutation acting on what a pipe, a loop or a variable hands it, in a command that names protected files.
    return computedMutation && (anyHit || namesProtected);
}

function decide(payload) {
    const tool = payload.tool_name;
    const input = payload.tool_input || {};
    const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : WORKSPACE;
    if (FILE_TOOLS.has(tool)) {
        const target = input.file_path || input.notebook_path;
        return typeof target === "string" && isProtectedPath(resolvePath(target, cwd));
    }
    if (tool === "Bash" && typeof input.command === "string") {
        try {
            return commandDenies(input.command, cwd);
        } catch {
            return NAME_PATTERN.test(input.command);
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Self-test and entry point
// ---------------------------------------------------------------------------

function runSelfTest() {
    const bash = (command) => ({ tool_name: "Bash", tool_input: { command }, cwd: WORKSPACE });
    const file = (tool, filePath) => ({ tool_name: tool, tool_input: { file_path: filePath }, cwd: WORKSPACE });
    const sample = listProtected()[0];
    if (!sample) {
        console.log("self-test: no public/**/source.txt found under " + WORKSPACE);
        process.exit(1);
    }
    const rel = path.relative(WORKSPACE, sample);
    const dir = path.dirname(rel);
    const SCRATCH = "/private/tmp/claude-501/-Volumes-work-youngjin/session/scratchpad";

    const deny = [
        file("Edit", sample),
        file("Write", sample),
        file("Write", path.join(WORKSPACE, "public/new-series/source.txt")),
        file("MultiEdit", sample),
        bash(`rm ${rel}`),
        bash(`rm -rf ${dir}`),
        bash("rm -rf public"),
        bash("rm -rf ."),
        bash("rm -rf *"),
        bash(`cd ${dir} && rm -f *`),
        bash(`cd public && rm -rf ${path.basename(dir)}`),
        bash(`mv ${rel} ${SCRATCH}/x.txt`),
        bash(`mv ${dir} ${SCRATCH}/`),
        bash(`cp ${SCRATCH}/draft.txt ${rel}`),
        bash(`cp ${SCRATCH}/source.txt ${dir}/`),
        bash(`ln -sf ${SCRATCH}/x ${rel}`),
        bash(`rsync -a --delete ${SCRATCH}/backup/ ${dir}/`),
        bash(`sed -i '' 's/a/b/' ${rel}`),
        bash("sed -i.bak -e 's/a/b/' public/*/source.txt"),
        bash("sed -i '' 's/a/b/' public/*/*.txt"),
        bash(`perl -pi -e 's/a/b/' ${rel}`),
        bash(`truncate -s 0 ${rel}`),
        bash(`touch ${rel}`),
        bash(`dd if=/dev/zero of=${rel} count=1`),
        bash(`echo x >> ${rel}`),
        bash(`: > ${rel}`),
        bash(`printf x | tee ${rel}`),
        bash(`cat > ${rel} <<'EOF'\nnew text\nEOF`),
        bash("find public -name source.txt -delete"),
        bash("find . -name '*.txt' -exec sed -i '' 's/a/b/' {} +"),
        bash("find public -name source.txt | xargs rm"),
        bash("for f in public/*/source.txt; do rm \"$f\"; done"),
        bash(`P=${dir}; rm "$P/source.txt"`),
        bash(`F=${rel}; rm "$F"`),
        bash(`rm "$(ls ${rel})"`),
        bash(`echo $(rm ${rel})`),
        bash(`python3 - <<'EOF'\nopen('${rel}', 'w').write('x')\nEOF`),
        bash(`node -e "require('fs').writeFileSync('${rel}', 'x')"`),
        bash(`bash -c 'rm ${rel}'`),
        bash(`git rm ${rel}`),
        bash(`git checkout -- ${rel}`),
        bash(`git checkout HEAD ${rel}`),
        bash(`git restore ${rel}`),
        bash(`git -C ${dir} checkout source.txt`),
        bash(`tar -xf ${SCRATCH}/a.tar -C ${dir}`),
    ];
    const denyWhenDirty = [
        bash("git checkout -- ."),
        bash("git restore ."),
        bash("git reset --hard"),
        bash("git reset --hard HEAD~1"),
        bash("git stash"),
        bash("git stash push -m wip"),
        bash("git clean -fd"),
    ];
    const allow = [
        file("Edit", path.join(WORKSPACE, dir, "page-1.html")),
        file("Write", path.join(SCRATCH, "source.txt.notes")),
        file("Read", sample),
        bash(`cat ${rel}`),
        bash(`grep -n Alice ${rel}`),
        bash("wc -l public/*/source.txt"),
        bash(`head -c 300 ${rel} | xxd`),
        bash(`git diff -- ${rel}`),
        bash(`git log --oneline -- ${rel}`),
        bash(`git show HEAD:${rel}`),
        bash(`git add ${rel}`),
        bash(`cp ${rel} ${SCRATCH}/copy.txt`),
        bash(`cat ${rel} > ${SCRATCH}/copy.txt`),
        bash(`cp -r ${dir} ${SCRATCH}/`),
        bash(`cp ${SCRATCH}/figure.jpg ${dir}/`),
        bash(`sed -i '' 's/a/b/' ${dir}/page-1.html`),
        bash("rm -rf public/app/assets/audio"),
        bash("rm -rf temp/junk && mkdir -p temp/junk"),
        bash("find public -name source.txt"),
        bash("ls public"),
        bash("npm run build -- --ssg"),
        bash("node dist/server/bundle.js"),
        bash("node .claude/hooks/protectLibrarySources.js --self-test"),
        bash("git status --short && git log --oneline -3"),
        bash("git stash list"),
        bash("git checkout main"),
        bash("echo $(date) > temp/when.txt"),
        bash("for f in temp/*.md; do wc -l \"$f\"; done"),
        bash(`P=${SCRATCH}/probe.js; echo "result: $(node "$P" ${WORKSPACE})"`),
        bash(`cd ${WORKSPACE} && node "$SCRIPT" --check`),
        bash(`SP=${SCRATCH}; cd ${WORKSPACE} && node "$SP/build.mjs" "$SP"`),
    ];
    deny.push(
        bash(`F=${rel}; echo "$(rm "$F")"`),
        bash(`D=${dir}; X=$(rm -rf "$D")`),
    );

    let failures = 0;
    const check = (cases, expected, label) => {
        for (const payload of cases) {
            if (decide(payload) !== expected) {
                failures += 1;
                console.log(`${label}: ${payload.tool_name} ${JSON.stringify(payload.tool_input)}`);
            }
        }
    };
    dirtyOverride = [];
    check(deny, true, "SHOULD DENY but did not");
    check(allow, false, "SHOULD NOT DENY but did");
    check(denyWhenDirty, false, "SHOULD NOT DENY (nothing uncommitted) but did");
    dirtyOverride = [` M ${rel}`, "?? public/new-series/source.txt"];
    check(denyWhenDirty, true, "SHOULD DENY (uncommitted changes) but did not");
    const total = deny.length + allow.length + denyWhenDirty.length * 2;
    console.log(failures === 0 ? `self-test: all ${total} cases pass` : `self-test: ${failures} failure(s)`);
    process.exit(failures === 0 ? 0 : 1);
}

function main() {
    if (process.argv.includes("--self-test")) return runSelfTest();
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
        raw += chunk;
    });
    process.stdin.on("end", () => {
        let payload;
        try {
            payload = JSON.parse(raw);
        } catch {
            process.exit(0);
        }
        let denied;
        try {
            denied = decide(payload);
        } catch {
            denied = NAME_PATTERN.test(raw);
        }
        if (denied) {
            process.stdout.write(JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: "PreToolUse",
                    permissionDecision: "deny",
                    permissionDecisionReason: REASON,
                },
            }));
        }
        process.exit(0);
    });
}

main();
