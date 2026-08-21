// VPS maintenance: what the box needs, gathered in one SSH round trip and reported as JSON.
//
// This exists so that routine maintenance is not a sequence of thirty ad-hoc `ssh root@...`
// commands. That shape is bad twice over: every one of them is a permission prompt, and an
// assistant holding a general-purpose root shell on this machine is holding one on production —
// live and staging share this VPS. So the read-only survey is a single audited command with a
// fixed command set, and everything that changes the machine is a separate, explicit verb.
//
// Usage:
//   node dev/scripts/vps/maintenance.js audit [--refresh] [--json]
//   node dev/scripts/vps/maintenance.js reclaim --dry-run | --apply
//   node dev/scripts/vps/maintenance.js upgrade --dry-run | --apply
//
// `audit` never modifies the machine (with --refresh it also updates the apt package index,
// which is why that is opt-in rather than automatic). `reclaim` and `upgrade` default to
// --dry-run: an invocation missing the flag reports and changes nothing.
//
// There is deliberately no reboot verb, and no `full-upgrade`. A new kernel is installed but
// never booted until a human does it, because this machine serves production — the procedure
// lives in docs/devOps/vps/maintenance.md and is meant to be read before it is run.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SSH_TARGET = "root@222.239.251.208";
const HEALTH_URLS = { live: "https://app.thingspool.net/health", staging: "https://staging.thingspool.net/health" };
const REPO_ROOT = path.join(__dirname, "../../..");

// Thresholds at which the audit stops describing and starts advising.
const LIMITS = {
    diskPercent: 80,          // % used on / before it is worth acting on
    bootPercent: 70,          // /boot is small and a kernel install needs room in it
    journalMB: 250,           // the ceiling basic-setup sets is 200M; drift above it means it is not being honoured
    pm2LogsMB: 200,
    aptCacheMB: 300,
    certDays: 21,             // certbot renews at 30 days left, so fewer than this means renewal is failing
    upgradable: 20,           // a backlog this long means unattended-upgrades is not running
    aptIndexAgeHours: 48,
    restarts: 5,              // pm2 restart count since the process was started
    authFailures: 500,        // failed SSH logins in 24h; some is constant background, a lot is not
    memPercent: 85,
};

const MARKER = "@@__SECTION__@@";

// ─── Remote command set ─────────────────────────────────────────────────
//
// Every command here reads. Nothing in this list writes, installs, deletes or restarts, which
// is what makes `audit` safe to run without asking. Keep it that way: a write belongs in one of
// the explicit verbs below, where the caller has to opt in.
function auditCommands(refresh)
{
    return [
        ["release",   `. /etc/os-release && echo "$PRETTY_NAME"`],
        ["kernel",    `uname -r`],
        ["uptime",    `uptime -p; cat /proc/loadavg`],
        ["reboot",    `if [ -f /var/run/reboot-required ]; then echo REQUIRED; cat /var/run/reboot-required.pkgs 2>/dev/null; else echo NO; fi`],
        ["aptindex",  `stat -c %Y /var/lib/apt/lists 2>/dev/null || echo 0`],
        ["aptupdate", refresh ? `apt-get update -qq 2>&1 | tail -3` : `echo SKIPPED`],
        ["upgradable",`apt list --upgradable 2>/dev/null | tail -n +2`],
        ["periodic",  `apt-config dump 2>/dev/null | grep -i 'APT::Periodic'`],
        ["aptTimer",  `systemctl list-timers --all --no-pager 2>/dev/null | grep apt-daily-upgrade || echo NONE`],
        ["autoupg",   `cat /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null || echo MISSING`],
        ["disk",      `df -BM --output=target,size,used,avail,pcent / /boot 2>/dev/null | tail -n +2`],
        ["journal",   `journalctl --disk-usage 2>/dev/null`],
        // Rotated logs are counted in both forms. pm2-logrotate runs with compression on, so a
        // rotated log spends almost all of its life as `.log.gz`, and counting only `.log` reports
        // a machine with a full backlog as having none.
        ["pm2logs",   `du -sm /root/.pm2/logs 2>/dev/null | cut -f1; ` +
                      `ls /root/.pm2/logs/*__*.log /root/.pm2/logs/*__*.log.gz 2>/dev/null | wc -l; ` +
                      `ls /root/.pm2/logs/*__*.log 2>/dev/null | wc -l`],
        // Only `archives` — the downloaded .deb files — is what `apt-get clean` frees. The rest of
        // /var/cache/apt is pkgcache.bin and srcpkgcache.bin, which apt rebuilds immediately and
        // clean does not touch; counting those reports a permanent ~144MB as reclaimable, and the
        // same figure comes back unchanged after every reclaim.
        ["aptcache",  `du -sm /var/cache/apt/archives 2>/dev/null | cut -f1`],
        ["rcpkgs",    `dpkg -l 2>/dev/null | awk '/^rc/ {print $2}'`],
        ["kernels",   `dpkg -l 2>/dev/null | awk '/^ii +linux-image-[0-9]/ {print $2}'`],
        ["dpkgaudit", `dpkg --audit 2>&1 | head -20`],
        // `/bin` is a symlink to `/usr/bin` on this release, so `which -a` reports the one
        // binary twice. Canonicalise before deduplicating, or every audit reports a second
        // Node.js that does not exist.
        ["node",      `node -v; for p in $(which -a node); do readlink -f "$p"; done | sort -u`],
        ["pm2",       `pm2 jlist 2>/dev/null`],
        ["pm2saved",  `stat -c %Y /root/.pm2/dump.pm2 2>/dev/null || echo 0`],
        ["services",  `for s in nginx ssh fail2ban pm2-root unattended-upgrades; do echo "$s $(systemctl is-active $s 2>/dev/null) $(systemctl is-enabled $s 2>/dev/null)"; done`],
        ["certs",     `certbot certificates 2>/dev/null | grep -E 'Certificate Name|Domains|Expiry Date' || echo NONE`],
        ["certTimer", `systemctl list-timers --all --no-pager 2>/dev/null | grep -i certbot || echo NONE`],
        ["fail2ban",  `fail2ban-client status 2>/dev/null | tr -d '\\t' || echo NONE`],
        ["sshd",      `sshd -T 2>/dev/null | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|permitemptypasswords|port) '`],
        // Password authentication is off, so "Failed password" is rare by construction and the
        // real measure of probing is rejected usernames plus overall SSH log volume.
        ["authfail",  `journalctl -u ssh --since '24 hours ago' --no-pager 2>/dev/null | grep -ci 'Failed password\\|Invalid user' || echo 0`],
        ["authlines", `journalctl -u ssh --since '24 hours ago' --no-pager 2>/dev/null | wc -l`],
        ["ports",     `ss -tlnH 2>/dev/null | awk '{print $4}' | sort -u`],
        ["runner",    `cat /root/actions-runner/.path /root/actions-runner/.env 2>/dev/null || echo NONE`],
        ["mem",       `free -m | awk '/^Mem:/ {print $2, $3}'`],
    ].filter(([, cmd]) => cmd);
}

function ssh(command)
{
    // BatchMode keeps this non-interactive: without an agent key it fails fast rather than
    // hanging on a password prompt that no agent can answer. LogLevel=ERROR suppresses the
    // client's advisory banners, which would otherwise land inside a parsed section.
    return execFileSync("ssh",
        ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", "-o", "LogLevel=ERROR", SSH_TARGET, command],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function runSections(commands)
{
    // The blank line before each marker is not cosmetic. Some commands (`pm2 jlist` above all)
    // print without a trailing newline, which would otherwise leave the next marker appended to
    // the end of their output — the marker is then never recognised, and that section and the
    // one after it both come back empty.
    const script = commands
        .map(([key, cmd]) => `echo ""; echo "${MARKER}${key}"; { ${cmd}; } 2>&1 || true`)
        .join("\n");

    const raw = ssh(script);
    const out = {};
    let current = null;

    for (const line of raw.split("\n"))
    {
        if (line.startsWith(MARKER))
        {
            current = line.slice(MARKER.length).trim();
            out[current] = [];
        }
        else if (current)
        {
            out[current].push(line);
        }
    }

    for (const key of Object.keys(out))
        out[key] = out[key].join("\n").trim();

    return out;
}

// ─── Parsing ────────────────────────────────────────────────────────────

function parseDisk(text)
{
    const mounts = {};
    for (const line of text.split("\n").filter(Boolean))
    {
        const [target, size, used, avail, pcent] = line.trim().split(/\s+/);
        if (!target) continue;
        mounts[target] = {
            sizeMB: parseInt(size, 10) || 0,
            usedMB: parseInt(used, 10) || 0,
            availMB: parseInt(avail, 10) || 0,
            usedPercent: parseInt(pcent, 10) || 0,
        };
    }
    return mounts;
}

function parseCerts(text)
{
    if (!text || text === "NONE") return [];

    const certs = [];
    let current = null;

    for (const line of text.split("\n"))
    {
        const name = line.match(/Certificate Name:\s*(.+)/);
        const domains = line.match(/Domains:\s*(.+)/);
        const expiry = line.match(/Expiry Date:\s*(\S+ \S+)[^(]*\(VALID: ([^)]+)\)/)
                    || line.match(/Expiry Date:\s*(\S+ \S+)[^(]*\(([^)]+)\)/);

        if (name)
        {
            current = { name: name[1].trim(), domains: [], expiry: null, daysLeft: null, valid: null };
            certs.push(current);
        }
        else if (domains && current)
        {
            current.domains = domains[1].trim().split(/\s+/);
        }
        else if (expiry && current)
        {
            current.expiry = expiry[1];
            current.valid = expiry[2];
            const days = expiry[2].match(/(\d+)\s*day/);
            current.daysLeft = days ? parseInt(days[1], 10) : (/INVALID|EXPIRED/i.test(expiry[2]) ? 0 : null);
        }
    }
    return certs;
}

function parsePm2(text)
{
    try
    {
        const start = text.indexOf("[");
        if (start < 0) return [];
        const list = JSON.parse(text.slice(start));
        return list.map((p) => ({
            name: p.name,
            status: p.pm2_env && p.pm2_env.status,
            restarts: (p.pm2_env && p.pm2_env.restart_time) || 0,
            unstableRestarts: (p.pm2_env && p.pm2_env.unstable_restarts) || 0,
            uptimeMs: p.pm2_env && p.pm2_env.pm_uptime ? Date.now() - p.pm2_env.pm_uptime : null,
            memoryMB: p.monit ? Math.round(p.monit.memory / 1048576) : null,
            nodeVersion: p.pm2_env && p.pm2_env.node_version,
        }));
    }
    catch
    {
        return [];
    }
}

function parseServices(text)
{
    const services = {};
    for (const line of text.split("\n").filter(Boolean))
    {
        const [name, active, enabled] = line.trim().split(/\s+/);
        if (name) services[name] = { active, enabled };
    }
    return services;
}

function parseFail2ban(text)
{
    if (!text || text === "NONE") return { available: false, jails: [] };
    const jails = (text.match(/Jail list:\s*(.*)/) || [, ""])[1]
        .split(",").map((s) => s.trim()).filter(Boolean);
    return { available: true, jails };
}

function parseSshd(text)
{
    const config = {};
    for (const line of (text || "").split("\n").filter(Boolean))
    {
        const [key, value] = line.trim().split(/\s+/);
        if (key) config[key] = value;
    }
    return config;
}

function expectedNodeMajor()
{
    return fs.readFileSync(path.join(REPO_ROOT, ".nvmrc"), "utf8").trim().replace(/^v/, "").split(".")[0];
}

function health(url)
{
    try
    {
        const body = execFileSync("curl",
            ["-s", "--max-time", "10", "-w", "\\n%{http_code}", url],
            { encoding: "utf8" });
        const lines = body.trim().split("\n");
        const status = parseInt(lines.pop(), 10);
        let payload = null;
        try { payload = JSON.parse(lines.join("\n")); } catch { /* health may not be JSON */ }
        return { status, ok: status === 200, payload };
    }
    catch (e)
    {
        return { status: 0, ok: false, error: e.message };
    }
}

// ─── Findings ───────────────────────────────────────────────────────────
//
// The point of this section is that the caller does not have to interpret raw shell output.
// Each finding names what is wrong, why it matters, and the action that addresses it — and
// every action is either a verb of this script or a section of the maintenance doc, never an
// improvised command.

function buildFindings(state)
{
    const findings = [];
    const add = (severity, area, what, why, action) => findings.push({ severity, area, what, why, action });

    // ── Patch level ──
    if (state.os.rebootRequired)
    {
        add("warn", "os",
            `A reboot is pending${state.os.rebootPackages.length ? ` (${state.os.rebootPackages.join(", ")})` : ""}.`,
            "Automatic reboots are disabled on purpose, so a kernel or libc update is installed but not running until someone boots it.",
            "Human-only: docs/devOps/vps/maintenance.md#applying-a-kernel-update. This machine serves production — do not reboot as part of an automated run.");
    }

    if (state.os.upgradable.length > LIMITS.upgradable)
    {
        add("warn", "os",
            `${state.os.upgradable.length} packages are upgradable.`,
            "unattended-upgrades goes quiet rather than loud when it is misconfigured: systemd still reports the unit active while nothing is ever installed. A long backlog is the real signal.",
            "node dev/scripts/vps/maintenance.js upgrade --dry-run, then --apply after reading the plan.");
    }
    else if (state.os.upgradable.length > 0)
    {
        add("info", "os",
            `${state.os.upgradable.length} packages are upgradable.`,
            "unattended-upgrades draws only from the security pocket, so a few non-security packages legitimately linger.",
            "No action needed unless the count keeps climbing.");
    }

    if (state.os.autoUpgradesConfig === "MISSING")
    {
        add("critical", "os",
            "/etc/apt/apt.conf.d/20auto-upgrades is missing.",
            "Without it APT::Periodic::Unattended-Upgrade defaults to off and the machine takes no security patches at all, while systemd still reports the service as healthy.",
            "docs/devOps/vps/basic-setup.md#5-enable-automatic-security-updates");
    }
    else if (!/Unattended-Upgrade\s+"1"/.test(state.os.periodic))
    {
        add("critical", "os",
            "APT::Periodic::Unattended-Upgrade is not set to 1.",
            "Security updates are not being installed automatically.",
            "docs/devOps/vps/maintenance.md#verifying-that-automatic-updates-actually-run");
    }

    if (state.os.aptTimer === "NONE")
    {
        add("warn", "os", "The apt-daily-upgrade timer is not scheduled.",
            "The schedule is what actually triggers an unattended upgrade run.",
            "docs/devOps/vps/maintenance.md#verifying-that-automatic-updates-actually-run");
    }

    // An index that is merely hours old is old enough to hide a security update entirely: the
    // upgradable list is a reading of the index, not of what the archives currently hold, so an
    // audit that did not refresh reports whatever was true when the index was last written — a
    // shorter list and a lower security count, with nothing to say it is short. Only a refreshed
    // index makes "0 upgradable" mean anything, so an unrefreshed run says so every time rather
    // than at a threshold.
    if (!state.refreshedIndex)
    {
        const stale = state.os.aptIndexAgeHours > LIMITS.aptIndexAgeHours;
        add(stale ? "warn" : "info", "os",
            `The upgradable list was read from an index last refreshed ${state.os.aptIndexAgeHours}h ago.`,
            stale
                ? "That is stale enough to be a sign the daily timer is not firing, and the list and its security count are both understated by however much has been published since."
                : "The list and its security count are as old as the index, so packages published since are missing from both — an audit that did not refresh cannot be read as an all-clear.",
            "Re-run with --refresh before treating the list as current.");
    }

    if (state.os.dpkgAudit)
    {
        add("critical", "os", "dpkg reports packages in a broken state.",
            "A half-configured package blocks every later install, including security updates.",
            "docs/devOps/vps/maintenance.md#how-to-clean-up-unused-linux-kernels (step 7).");
    }

    // ── Disk ──
    for (const [mount, info] of Object.entries(state.disk))
    {
        const limit = mount === "/boot" ? LIMITS.bootPercent : LIMITS.diskPercent;
        if (info.usedPercent >= limit)
        {
            add(info.usedPercent >= 90 ? "critical" : "warn", "disk",
                `${mount} is ${info.usedPercent}% full (${info.availMB}MB free).`,
                mount === "/boot"
                    ? "A full /boot makes the next kernel install fail part-way and leaves dpkg broken."
                    : "A full root filesystem takes the app and the database client down with it.",
                mount === "/boot"
                    ? "docs/devOps/vps/maintenance.md#how-to-clean-up-unused-linux-kernels"
                    : "node dev/scripts/vps/maintenance.js reclaim --dry-run");
        }
    }

    const reclaimable = state.reclaimable;
    if (reclaimable.totalMB > 0)
    {
        const severity = reclaimable.totalMB > 1024 ? "warn" : "info";
        add(severity, "disk",
            `About ${reclaimable.totalMB}MB is reclaimable (${reclaimable.detail.join("; ")}).`,
            "Log growth is bounded going forward, but a backlog predating those limits is never removed retroactively.",
            "node dev/scripts/vps/maintenance.js reclaim --apply");
    }

    if (state.disk.journalMB > LIMITS.journalMB)
    {
        add("info", "disk",
            `The systemd journal is using ${state.disk.journalMB}MB.`,
            "The journal honours a new size ceiling only for future writes, so an old backlog sits there until it is vacuumed explicitly.",
            "node dev/scripts/vps/maintenance.js reclaim --apply");
    }

    // ── Certificates ──
    for (const cert of state.certs)
    {
        if (cert.daysLeft === null) continue;

        if (cert.daysLeft <= 0)
        {
            add("critical", "tls", `Certificate "${cert.name}" has expired.`,
                "Every browser refuses the site outright.",
                "docs/devOps/vps/networking-and-security.md — reissue with certbot.");
        }
        else if (cert.daysLeft < LIMITS.certDays)
        {
            add("warn", "tls", `Certificate "${cert.name}" expires in ${cert.daysLeft} days.`,
                "Certbot renews at 30 days remaining, so anything below that means renewal has already failed at least once — usually because port 80 is blocked or Nginx is down during the challenge.",
                "ssh root@222.239.251.208 \"certbot renew --dry-run -v\" and read why it fails.");
        }
    }

    if (state.certs.length === 0)
    {
        add("warn", "tls", "certbot reports no certificates.",
            "Either certbot is not installed or the certificates are not under its management, in which case nothing renews them.",
            "docs/devOps/vps/networking-and-security.md");
    }

    if (state.certTimer === "NONE" && state.certs.length > 0)
    {
        add("warn", "tls", "No certbot renewal timer is scheduled.",
            "Certificates are renewed by a timer, not by the certbot command that issued them.",
            "systemctl list-timers | grep certbot on the VPS, then reinstate the timer.");
    }

    // ── Security ──
    if (state.security.sshd.permitrootlogin && !/without-password|prohibit-password/.test(state.security.sshd.permitrootlogin))
    {
        add("warn", "security", `sshd PermitRootLogin is "${state.security.sshd.permitrootlogin}".`,
            "Deployment relies on root over SSH, so root login stays enabled — but it must be key-only.",
            "docs/devOps/vps/basic-setup.md#3-secure-ssh-access");
    }

    if (state.security.sshd.passwordauthentication === "yes")
    {
        add("critical", "security", "sshd accepts password authentication.",
            "This machine is exposed to the public internet and is continuously probed; passwords are what those probes are for.",
            "docs/devOps/vps/basic-setup.md#3-secure-ssh-access");
    }

    if (!state.security.fail2ban.available)
    {
        add("warn", "security", "fail2ban is not responding.",
            "Nothing is rate-limiting repeated SSH authentication failures.",
            "docs/devOps/vps/basic-setup.md#4-install-fail2ban");
    }

    if (state.security.authFailures24h > LIMITS.authFailures)
    {
        add("info", "security", `${state.security.authFailures24h} failed SSH logins in the last 24h.`,
            "A constant background of scanner traffic is normal on a public IP; a sharp change in it is not.",
            "Compare against the previous run. Confirm fail2ban is banning by checking its jail counts.");
    }

    // ── Runtime ──
    const expected = state.runtime.expectedNodeMajor;
    if (state.runtime.nodeMajor && state.runtime.nodeMajor !== expected)
    {
        add("critical", "runtime",
            `The VPS runs Node v${state.runtime.nodeVersion} but .nvmrc expects v${expected}.x.`,
            "Deployment asserts the runtime against .nvmrc, so every deploy fails at its verification step — and the e2e suite, which runs only after a successful deploy, is skipped along with it.",
            "docs/devOps/vps/maintenance.md#how-to-upgrade-the-nodejs-version");
    }

    if (state.runtime.nodePaths.length > 1)
    {
        add("warn", "runtime", `More than one node is on PATH: ${state.runtime.nodePaths.join(", ")}.`,
            "PM2 and the Actions runner both resolve `node` against PATH, so a second install silently decides which version the apps run on — and a version manager is invisible to them because it loads from the shell profile.",
            "docs/devOps/vps/maintenance.md#keep-a-single-nodejs-on-the-vps");
    }

    if (/\/\.nvm\/|\/v\d+\.\d+\.\d+\//.test(state.runtime.runnerPath))
    {
        add("warn", "runtime", "The Actions runner's .path or .env names a version-numbered Node.js directory.",
            "Those files are captured once at runner setup and survive every restart, so the runner keeps using a Node.js that upgrading the system one does not move.",
            "docs/devOps/vps/maintenance.md#the-self-hosted-runner-and-nodejs");
    }

    for (const proc of state.runtime.pm2)
    {
        if (proc.status !== "online")
        {
            add("critical", "runtime", `PM2 process "${proc.name}" is ${proc.status}.`,
                "The app is not serving.",
                "pm2 logs " + proc.name + " on the VPS, then restart once the cause is known.");
        }
        if (proc.unstableRestarts > 0)
        {
            add("critical", "runtime", `"${proc.name}" has ${proc.unstableRestarts} unstable restarts.`,
                "PM2 counts a restart as unstable when the process died again within seconds of coming up — a crash loop, not a deployment.",
                "pm2 logs " + proc.name + " --err on the VPS.");
        }
        else if (proc.restarts > LIMITS.restarts)
        {
            // Deliberately info, not warn: this counter is cumulative since PM2 first created
            // the process, so on a machine that deploys from CI it is mostly a deployment count.
            // What makes it a finding is a jump between two audits, which is why the number is
            // reported rather than only the fact that it is above a threshold.
            add("info", "runtime", `"${proc.name}" has restarted ${proc.restarts} times since PM2 created it.`,
                "Deployments account for most of these. A rise since the previous audit that no deployment explains is the case worth chasing — usually a memory ceiling being hit.",
                "Compare against the previous audit; if it moved unexpectedly, node dev/scripts/playtest/serverMonitor.js history --app " + proc.name);
        }
        if (proc.nodeVersion && proc.nodeVersion.split(".")[0] !== expected)
        {
            add("critical", "runtime", `"${proc.name}" is running on Node v${proc.nodeVersion}, not v${expected}.x.`,
                "The PM2 daemon spawns apps with the interpreter it inherited when the daemon itself started, so installing a newer Node.js does not move the running apps onto it.",
                "pm2 update on the VPS — see docs/devOps/vps/maintenance.md#how-to-upgrade-the-nodejs-version");
        }
    }

    if (state.runtime.pm2SavedAgeHours !== null && state.runtime.pm2.length > 0 && state.runtime.pm2SavedAgeHours > 24 * 30)
    {
        add("info", "runtime", `PM2's saved process list is ${Math.round(state.runtime.pm2SavedAgeHours / 24)} days old.`,
            "The boot unit resurrects whatever was saved, not whatever is running, so a reboot would come back to that older list.",
            "pm2 save on the VPS before any reboot.");
    }

    for (const [name, info] of Object.entries(state.services))
    {
        if (name === "unattended-upgrades") continue; // its unit is a shutdown hook; state says nothing useful
        if (info.active !== "active")
            add("critical", "services", `${name} is ${info.active}.`, "A core service is down.", `systemctl status ${name} on the VPS.`);
        else if (info.enabled !== "enabled")
            add("warn", "services", `${name} is running but not enabled at boot.`, "It would not come back after a reboot.", `systemctl enable ${name} on the VPS.`);
    }

    if (state.memory.usedPercent > LIMITS.memPercent)
    {
        add("warn", "runtime", `Memory is ${state.memory.usedPercent}% used (${state.memory.usedMB}/${state.memory.totalMB}MB).`,
            "This VPS runs live, staging and the Actions runner together, and the runner's build step is the spike that pushes it over.",
            "Check pm2 memory ceilings and whether a build is running concurrently.");
    }

    // ── Health ──
    for (const [app, result] of Object.entries(state.health))
    {
        if (!result.ok)
        {
            add("critical", "health", `${app} health check returned ${result.status || result.error}.`,
                "The public path to the app — DNS, Nginx, TLS, the process — is broken somewhere along its length.",
                "Correlate with the services and runtime sections above.");
        }
    }

    const order = { critical: 0, warn: 1, info: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);
    return findings;
}

// ─── Verbs ──────────────────────────────────────────────────────────────

function audit(options)
{
    const sections = runSections(auditCommands(options.refresh));

    const upgradable = sections.upgradable.split("\n").map((l) => l.trim()).filter(Boolean);
    const rcPackages = sections.rcpkgs.split("\n").map((l) => l.trim()).filter(Boolean);
    const kernels = sections.kernels.split("\n").map((l) => l.trim()).filter(Boolean);
    // Rotated logs, and the subset of them still uncompressed — which is all `reclaim` can act on,
    // since pm2-logrotate has already compressed the rest.
    const [pm2LogsMB, rotatedLogCount, uncompressedRotatedLogCount] =
        sections.pm2logs.split("\n").map((n) => parseInt(n, 10) || 0);
    const aptCacheMB = parseInt(sections.aptcache, 10) || 0;
    const journalMB = Math.round(parseFloat((sections.journal.match(/([\d.]+)([MG])/) || [])[1] || 0)
        * ((sections.journal.match(/[\d.]+([MG])/) || [])[1] === "G" ? 1024 : 1));
    const aptIndexEpoch = parseInt(sections.aptindex, 10) || 0;
    const nodeVersion = (sections.node.split("\n")[0] || "").trim().replace(/^v/, "");
    const nodePaths = sections.node.split("\n").slice(1).map((l) => l.trim()).filter(Boolean);
    const [memTotal, memUsed] = (sections.mem || "0 0").trim().split(/\s+/).map((n) => parseInt(n, 10) || 0);
    const pm2SavedEpoch = parseInt(sections.pm2saved, 10) || 0;

    // Reclaimable space, itemised the same way `reclaim` acts on it.
    const detail = [];
    let totalMB = 0;
    if (journalMB > LIMITS.journalMB) { detail.push(`journal ${journalMB - 200}MB over its ceiling`); totalMB += journalMB - 200; }
    if (aptCacheMB > 50) { detail.push(`apt cache ${aptCacheMB}MB`); totalMB += aptCacheMB; }
    if (uncompressedRotatedLogCount > 0 && pm2LogsMB > 20) { detail.push(`${uncompressedRotatedLogCount} uncompressed rotated pm2 logs, ~${Math.round(pm2LogsMB * 0.9)}MB compressible`); totalMB += Math.round(pm2LogsMB * 0.9); }
    if (rcPackages.length > 0) { detail.push(`${rcPackages.length} packages in rc state`); }

    const state = {
        target: SSH_TARGET,
        checkedAt: new Date().toISOString(),
        refreshedIndex: !!options.refresh,
        os: {
            release: sections.release,
            kernel: sections.kernel,
            uptime: sections.uptime.split("\n")[0],
            loadAverage: (sections.uptime.split("\n")[1] || "").split(" ").slice(0, 3).join(" "),
            rebootRequired: sections.reboot.startsWith("REQUIRED"),
            rebootPackages: sections.reboot.split("\n").slice(1).filter(Boolean),
            upgradable,
            securityUpgradable: upgradable.filter((l) => /security/i.test(l)).length,
            periodic: sections.periodic,
            aptTimer: sections.aptTimer,
            autoUpgradesConfig: sections.autoupg,
            aptIndexAgeHours: aptIndexEpoch ? Math.round((Date.now() / 1000 - aptIndexEpoch) / 3600) : 9999,
            dpkgAudit: sections.dpkgaudit || null,
            installedKernels: kernels,
        },
        disk: { ...parseDisk(sections.disk), journalMB, pm2LogsMB, rotatedLogCount,
            uncompressedRotatedLogCount, aptCacheMB, rcPackages },
        reclaimable: { totalMB, detail },
        certs: parseCerts(sections.certs),
        certTimer: sections.certTimer === "NONE" ? "NONE" : sections.certTimer.trim(),
        security: {
            sshd: parseSshd(sections.sshd),
            fail2ban: parseFail2ban(sections.fail2ban),
            authFailures24h: parseInt(sections.authfail, 10) || 0,
            sshLogLines24h: parseInt(sections.authlines, 10) || 0,
            listeningPorts: sections.ports.split("\n").map((l) => l.trim()).filter(Boolean),
        },
        runtime: {
            nodeVersion,
            nodeMajor: nodeVersion.split(".")[0],
            expectedNodeMajor: expectedNodeMajor(),
            nodePaths,
            runnerPath: sections.runner,
            pm2: parsePm2(sections.pm2),
            pm2SavedAgeHours: pm2SavedEpoch ? Math.round((Date.now() / 1000 - pm2SavedEpoch) / 3600) : null,
        },
        services: parseServices(sections.services),
        memory: {
            totalMB: memTotal,
            usedMB: memUsed,
            usedPercent: memTotal ? Math.round((memUsed / memTotal) * 100) : 0,
        },
        health: { live: health(HEALTH_URLS.live), staging: health(HEALTH_URLS.staging) },
    };

    state.findings = buildFindings(state);
    state.summary = {
        critical: state.findings.filter((f) => f.severity === "critical").length,
        warn: state.findings.filter((f) => f.severity === "warn").length,
        info: state.findings.filter((f) => f.severity === "info").length,
    };
    return state;
}

// Non-disruptive housekeeping: nothing here installs, removes a live package, or restarts a
// service. Every item is something that regrows on its own and that the setup doc already
// treats as safe to drop at any time.
function reclaim(apply)
{
    const steps = [
        { name: "journal", why: "vacuum the systemd journal down to its intended ceiling",
          dry: `journalctl --disk-usage`,
          run: `journalctl --vacuum-size=200M 2>&1 | tail -2` },
        { name: "aptCache", why: "drop the downloaded package cache, which refills on the next upgrade",
          dry: `du -sh /var/cache/apt 2>/dev/null`,
          run: `apt-get clean && echo cleaned` },
        // pm2-logrotate compresses as it rotates, so this normally finds nothing to do. It stays
        // because that setting can be turned off, and because a log rotated in the window before
        // the compression worker runs is still uncompressed. Already-compressed logs are not
        // counted here — they are not work this step can do.
        { name: "pm2Logs", why: "compress rotated PM2 logs that pm2-logrotate has not compressed",
          dry: `ls /root/.pm2/logs/*__*.log 2>/dev/null | wc -l`,
          run: `if ls /root/.pm2/logs/*__*.log >/dev/null 2>&1; then gzip -f /root/.pm2/logs/*__*.log && echo compressed; else echo none; fi` },
        { name: "rcPackages", why: "purge config files left behind by already-removed packages",
          dry: `dpkg -l | awk '/^rc/ {print $2}' | wc -l`,
          run: `dpkg -l | awk '/^rc/ {print $2}' | xargs -r dpkg --purge >/dev/null 2>&1; echo purged` },
    ];

    const before = runSections([["disk", `df -BM --output=target,used,avail,pcent / 2>/dev/null | tail -n +2`]]);
    const results = runSections(steps.map((s) => [s.name, apply ? s.run : s.dry]));
    const after = apply
        ? runSections([["disk", `df -BM --output=target,used,avail,pcent / 2>/dev/null | tail -n +2`]])
        : before;

    return {
        target: SSH_TARGET,
        mode: apply ? "apply" : "dry-run",
        steps: steps.map((s) => ({ name: s.name, why: s.why, output: results[s.name] })),
        diskBefore: before.disk.trim(),
        diskAfter: after.disk.trim(),
        note: apply
            ? "Nothing here restarts a service or changes an installed package."
            : "Nothing was changed. Re-run with --apply to act on these.",
    };
}

// Package upgrades, held to `upgrade` rather than `full-upgrade`: plain upgrade never installs a
// new package, so a new kernel is held back and reported rather than pulled in. The config-
// preserving flags are what keep an upgrade from replacing sshd_config or the Nginx site config,
// which is how a maintenance window turns into an outage.
function upgrade(apply)
{
    const flags = `-o Dpkg::Options::=--force-confold -o Dpkg::Options::=--force-confdef`;

    if (!apply)
    {
        const out = runSections([
            ["update", `apt-get update -qq 2>&1 | tail -3; echo done`],
            ["plan", `apt-get -s upgrade 2>/dev/null | grep -E '^(Inst|Remv)' || echo "nothing to do"`],
            ["held", `apt-get -s full-upgrade 2>/dev/null | grep -E '^Inst.*linux-image' || echo "no kernel pending"`],
        ]);
        return {
            target: SSH_TARGET,
            mode: "dry-run",
            willInstall: out.plan.split("\n").filter((l) => l.startsWith("Inst")),
            willRemove: out.plan.split("\n").filter((l) => l.startsWith("Remv")),
            kernelHeldBack: out.held,
            note: "Expect installs and zero removals. A removal in this list is a reason to stop and read it. " +
                  "A kernel shown as held back needs the manual procedure in docs/devOps/vps/maintenance.md#applying-a-kernel-update.",
        };
    }

    const out = runSections([
        ["update", `apt-get update -qq 2>&1 | tail -3; echo done`],
        ["upgrade", `DEBIAN_FRONTEND=noninteractive apt-get -y ${flags} upgrade 2>&1 | tail -30`],
        ["autoremove", `DEBIAN_FRONTEND=noninteractive apt-get -y --purge autoremove 2>&1 | tail -10`],
        ["reboot", `if [ -f /var/run/reboot-required ]; then echo REQUIRED; else echo NO; fi`],
        ["services", `for s in nginx ssh fail2ban pm2-root; do echo "$s $(systemctl is-active $s 2>/dev/null)"; done`],
        ["pm2", `pm2 status --no-color 2>&1 | tail -20`],
    ]);

    return {
        target: SSH_TARGET,
        mode: "apply",
        upgrade: out.upgrade,
        autoremove: out.autoremove,
        rebootRequired: out.reboot === "REQUIRED",
        servicesAfter: parseServices(out.services),
        pm2After: out.pm2,
        health: { live: health(HEALTH_URLS.live), staging: health(HEALTH_URLS.staging) },
        note: out.reboot === "REQUIRED"
            ? "A reboot is now pending. It is a human-only step on this machine — see docs/devOps/vps/maintenance.md#applying-a-kernel-update."
            : "No reboot pending.",
    };
}

// ─── Entry ──────────────────────────────────────────────────────────────

function main()
{
    const [verb, ...rest] = process.argv.slice(2);
    const apply = rest.includes("--apply");
    const refresh = rest.includes("--refresh");

    if (rest.includes("--apply") && rest.includes("--dry-run"))
    {
        console.error("--apply and --dry-run are mutually exclusive.");
        process.exit(2);
    }

    let result;
    switch (verb)
    {
        case "audit":   result = audit({ refresh }); break;
        case "reclaim": result = reclaim(apply); break;
        case "upgrade": result = upgrade(apply); break;
        default:
            console.error("Usage: node dev/scripts/vps/maintenance.js audit [--refresh] | reclaim [--dry-run|--apply] | upgrade [--dry-run|--apply]");
            process.exit(2);
    }

    console.log(JSON.stringify(result, null, 2));

    // A critical finding is worth a non-zero exit so a caller that only checks the status code
    // does not read a broken machine as a clean one.
    if (verb === "audit" && result.summary.critical > 0)
        process.exit(1);
}

try
{
    main();
}
catch (e)
{
    console.error(JSON.stringify({ error: e.message, target: SSH_TARGET }, null, 2));
    process.exit(3);
}
