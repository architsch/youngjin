---
name: vps-maintenance
description: Audit and maintain the VPS that hosts the live and staging servers — OS patch level, pending reboots, disk and log growth, TLS certificate expiry, SSH and fail2ban posture, Node.js/PM2 runtime drift, and service health — reporting findings by severity and applying only the non-disruptive fixes. Use when asked to check on the server, run VPS maintenance, look at disk space or certificates, verify the machine is patched and secure, or investigate whether the VPS itself explains a deployment problem.
---

# VPS Maintenance

One machine at `222.239.251.208` runs **both** the live server and the staging server, plus Nginx
and the self-hosted GitHub Actions runner. That is the single most important fact about this
skill: there is no maintenance window here that does not touch production. Anything that restarts
a service, changes an installed package, or boots the machine takes `app.thingspool.net` down with
it for as long as it lasts.

So the work is split by blast radius, and the split is enforced by the tool rather than by
intention.

## The tool

```
node dev/scripts/vps/maintenance.js audit   [--refresh]
node dev/scripts/vps/maintenance.js reclaim [--dry-run|--apply]
node dev/scripts/vps/maintenance.js upgrade [--dry-run|--apply]
```

Every verb prints JSON. `audit` gathers everything in **one SSH round trip** from a fixed command
set, none of which writes; `--refresh` additionally updates the apt package index, which is why it
is opt-in. `reclaim` and `upgrade` do nothing without `--apply` — a flagless invocation is a
dry run, not an accident waiting to happen.

**Do not reach for a bare `ssh root@…` to answer a question this script already answers.** The
script's command set is fixed and reviewable; an ad-hoc root shell on this machine is neither, and
it is a root shell on production. Use SSH directly only for the investigation a finding sends you
on — reading a specific log, checking one config file — never as the general way to look around.

## Step 1 — Audit

```
node dev/scripts/vps/maintenance.js audit
```

It exits non-zero when there is a critical finding, so a caller that only reads the status code
does not mistake a broken machine for a healthy one.

Read `findings` first — each carries what is wrong, why it matters, and the action that addresses
it — then go to the raw sections for the numbers behind any finding you intend to act on. The
sections are worth knowing individually:

| Section | What it settles |
|---|---|
| `os` | Patch backlog, pending reboot, and whether `unattended-upgrades` is *actually* running |
| `disk` | Root and `/boot` usage, journal size, PM2 log backlog, apt cache, `rc`-state packages |
| `certs` / `certTimer` | Let's Encrypt expiry per domain, and whether a renewal timer exists at all |
| `security` | sshd's effective config, fail2ban jails, SSH probing volume, listening ports |
| `runtime` | Node.js version against `.nvmrc`, duplicate interpreters, the Actions runner's frozen `PATH`, PM2 per-process status/restarts/memory |
| `services` | nginx, ssh, fail2ban, pm2-root — active *and* enabled |
| `health` | Public `/health` for live and staging, including the commit each is serving |

Three of these mislead if read naively, and the audit is built around exactly that:

- **`unattended-upgrades` fails silently.** systemd reports the unit active on a machine that has
  not taken a patch in years, because the visible unit is a shutdown hook rather than the upgrade
  run. Never conclude "patching is fine" from a service state. The evidence is the length of the
  upgradable list, `APT::Periodic::Unattended-Upgrade` reading `"1"`, and the `apt-daily-upgrade`
  timer having a next run time — all three of which the audit reports.
- **PM2 restart counts are cumulative since the process was created**, so on a machine that deploys
  from CI they are largely a deployment count. The finding is reported as `info` for that reason.
  What makes a restart count interesting is a *rise since the previous audit that no deployment
  explains*, or a non-zero `unstableRestarts`, which means the process died again within seconds of
  coming up — a crash loop, and always critical.
- **A certificate with fewer than 30 days left is already a failure.** Certbot renews at 30 days,
  so a smaller number means at least one renewal attempt has already failed — usually because port
  80 was blocked or Nginx was down during the challenge. Do not wait for it to approach zero.

The audit only reports a **pending reboot**; it will never perform one. See Boundaries.

## Step 2 — Act on what is safe

```
node dev/scripts/vps/maintenance.js reclaim --dry-run   # what it would free
node dev/scripts/vps/maintenance.js reclaim --apply     # free it
```

`reclaim` is confined to things that regrow on their own and that nothing depends on: vacuuming the
journal to its intended ceiling, dropping the apt package cache, compressing already-rotated PM2
logs, and purging config files belonging to packages that were removed long ago. **It restarts
nothing and changes no installed package**, which is what makes it the one mutation appropriate to
run without a human weighing it first.

Run the dry run and quote the numbers before applying. If it would free trivially little, say so
and skip it — a maintenance report whose only content is "cleaned 4MB" is noise.

## Step 3 — Package upgrades, deliberately

```
node dev/scripts/vps/maintenance.js upgrade --dry-run
```

**Read the plan before applying it.** Expect installs and zero removals; a removal in that list is a
reason to stop and ask, not a step to approve. The apply path uses the config-preserving dpkg
options, because without them an upgrade may replace a customised config file — and for
`sshd_config` or the Nginx site config that is how routine maintenance becomes an outage.

The verb is `upgrade`, never `full-upgrade`. Plain upgrade never installs a *new* package, so a new
kernel is held back and reported rather than pulled in. That is intended: pulling in a kernel
commits the machine to a reboot, and reboots here are a human decision.

Applying an upgrade needs the user's approval every time. Ask for it with the dry-run plan in hand,
not before.

## Boundaries

- **Never reboot the machine, and never propose doing so as part of an automated run.** The script
  has no reboot verb. A pending reboot is reported and left pending. When one is genuinely needed,
  hand the user
  [docs/devOps/vps/maintenance.md](../../../docs/devOps/vps/maintenance.md#applying-a-kernel-update),
  which covers the parts that are easy to lose: `pm2 save` first, because the boot unit resurrects
  the *saved* process list rather than what is currently running, and confirming a fallback kernel
  is still installed.
- **Never restart nginx, ssh, or a PM2 app to "see if that fixes it."** Both servers are behind
  those processes. A restart is a considered act with the user's approval, taken because a finding
  called for it.
- **Never edit files on the VPS by hand.** Nginx config is deployed from this repository
  (`npm run nginx:update`); application code arrives through the deployment workflow. A hand-edit
  on the box is overwritten by the next deployment and lost without trace.
- **The Node.js upgrade procedure is not this skill's to run.** If the audit reports a version
  mismatch, report it and point at
  [the documented procedure](../../../docs/devOps/vps/maintenance.md#how-to-upgrade-the-nodejs-version)
  — the ordering there (VPS first, push second) exists because getting it backwards fails the
  deployment and silently skips the e2e suite along with it.
- Log *reading* for application errors belongs to `serverMonitor.js` and the `staging-playtest`
  skill, which already classify this server's background noise. Do not re-derive that here.

## Reporting

Lead with severity, and separate the machine's condition from what you changed:

1. **Critical** — anything in `findings` at that level, each with the evidence from its section.
2. **Needs a human decision** — pending reboot, package upgrades, a Node.js mismatch. State what it
   is, what it would cost, and the documented procedure. Do not perform them.
3. **Applied** — what `reclaim` actually did, with before/after numbers.
4. **Healthy** — the checks that passed, briefly. Certificate days remaining, service states, both
   `/health` results and the commit each server reports, since a live and staging on different
   commits is a fact worth surfacing even when nothing is wrong.

Quote `checkedAt` and note that `audit` did not refresh the package index unless `--refresh` was
passed — an upgradable list read from a stale index is a stale list.
