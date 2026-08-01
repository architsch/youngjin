# VPS Maintenance

> Part of the [VPS Hosting Guide](./) — see also: [Basic Setup](basic-setup.md), [Networking & Security](networking-and-security.md), [Deployment](deployment.md)

## How to upgrade the Node.js version

`.nvmrc` in the repository root is the single source of truth. CI reads it through `actions/setup-node`, and every deployment asserts the VPS runtime against it. The VPS is the one place that cannot read it automatically, so it is upgraded by hand.

The subtlety worth knowing: the PM2 daemon spawns app processes with the `node` it inherited when the daemon itself started. Installing a newer Node.js does **not** move the running apps onto it — the daemon has to be respawned as well, which is what `pm2 update` does.

1. In the repository, set `.nvmrc` and package.json's `engines.node` to the new major, and bump `@types/node` to match. Switch your own machine over — see [Switching your own machine over](#switching-your-own-machine-over) — then reinstall the global CLIs, which do not follow you across the switch: see [Global CLIs do not survive a Node.js switch](#global-clis-do-not-survive-a-nodejs-switch).

2. Connect to the VPS:
```
ssh root@222.239.251.208
```

3. Install the new major (substitute the version `24` with the one from `.nvmrc`). If `node -v` does not report the version just installed, another Node.js is shadowing it — resolve that before continuing, see [Keep a single Node.js on the VPS](#keep-a-single-nodejs-on-the-vps):
```
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
node -v
which -a node
```

4. Respawn the PM2 daemon so the apps pick up the new interpreter:
```
pm2 update
```

5. Confirm the apps are back and running on the expected version:
```
pm2 status
pm2 jlist | grep -o '"node_version":"[^"]*"'
```

6. Confirm the self-hosted GitHub Actions runner's environment does not pin an old Node.js — see [The self-hosted runner and Node.js](#the-self-hosted-runner-and-nodejs).

7. Back in the repository, build and push the changeset from step 1:
```
npm run beforeCommit
git add -A && git commit && git push
```

A deployment whose runtime does not match `.nvmrc` fails at its "Verify runtime Node.js version" step, which is the signal that steps 3–4 were missed. This is why the push comes last: pushing beforehand builds correctly but restarts the app under the old interpreter, so the deployment fails and the e2e suite — which runs only after a successful deployment — is skipped until the workflow is re-run. Upgrading the VPS first also keeps the two risks apart, since it restarts the existing bundles on the new Node.js rather than pairing a new runtime with a new build.

### Switching your own machine over

```
nvm install && nvm use && nvm alias default 24 && node -v
```

The first two read `.nvmrc` on their own; the alias needs the major spelled out, so substitute it
there as in step 3.

`nvm use` switches only the shell it is typed into. `nvm alias default` is what every *new* shell
starts on, and without it the pre-commit check refuses the commit from any shell you did not switch
by hand — including the one your editor runs Git hooks in.

Changing the default does not reach a program that is already running. An editor resolves the login
environment once, when it launches, and hands that same copy to every terminal and hook it spawns
afterwards; reloading its window re-uses the copy rather than rebuilding it. So quit the editor
completely and start it again, then confirm with `node -v` in a fresh terminal. A stale environment
gives itself away as an old version directory still sitting on `PATH`.

### Global CLIs do not survive a Node.js switch

nvm gives every Node.js version its own installation prefix, and `npm install -g` writes into whichever one is active at the time. Switching majors swaps that prefix out wholesale. Nothing is deleted — the packages are still sitting under the old version — but they are no longer on `PATH`, so they read as never having been installed.

This bites locally because `npm run dev` shells out to two CLIs that are deliberately *not* `package.json` dependencies: `firebase` (firebase-tools), which starts the Firestore and Storage emulators, and `pm2`, which supervises the dev runner and has to outlive the npm process that launched it. Everything else the script needs is a local dev dependency and resolves through `node_modules/.bin` on its own, so those are the only two that a version switch can strand. Reinstate both on the new runtime and confirm they resolve:

```
npm install -g firebase-tools pm2
command -v firebase pm2
```

The resulting failure is easy to misread. The dev script runs the emulators and the server together under `concurrently -k`, so a missing binary exits `127` and `-k` immediately terminates the healthy half as well — one absent CLI presents as the whole command dying during startup rather than as a single `command not found`. When `npm run dev` stops abruptly after a version bump, check these two before anything else.

The VPS has the same hazard for a different reason: there the trigger is removing nvm rather than switching within it, but the packages are stranded identically — see [Keep a single Node.js on the VPS](#keep-a-single-nodejs-on-the-vps).

### Keep a single Node.js on the VPS

The VPS must have exactly one Node.js, the system one from NodeSource. PM2 and the Actions runner both pick their interpreter by resolving `node` against `PATH`, so a second install silently decides which version the apps run on. `which -a node` should therefore list only the system path.

A version manager such as nvm is the usual offender, and is particularly deceptive here: it is loaded from the shell profile, which systemd services and the Actions runner never read. An interactive SSH session then resolves one Node.js while automation resolves another, with no error on either side — an upgrade appears to do nothing, because `node -v` is reporting the version manager's copy rather than the one just installed.

Remove it rather than pointing it at the new version. Check first whether any globally installed packages under it need reinstating, then delete the directory, strip its lines from the shell profile, and start a fresh shell. Any global package installed through it — PM2 especially — must be reinstalled with the system `npm` afterwards, and the PM2 daemon respawned with `pm2 update`.

### The self-hosted runner and Node.js

The runner is a .NET service rather than a Node.js one, and it hands its own `PATH` down to the workflow steps it spawns. That `PATH` lives in the runner's own `.path` and `.env` files, captured from whatever shell ran `config.sh` during setup — so if a version manager was loaded at that moment, its *version-numbered* directory is frozen into those files and survives every restart. Check them:

```
cat /root/actions-runner/.path /root/actions-runner/.env
```

Neither should mention a versioned Node.js directory. If one does, edit the file — restarting alone will not help, since the stale path is re-read from disk — then restart the service:
```
cd /root/actions-runner && ./svc.sh stop && ./svc.sh start
```

Once those files name only stable paths, an upgrade needs nothing here: NodeSource replaces the binary already on that `PATH`, and the next workflow run picks it up unaided.

The runner also carries a bundled Node.js of its own, under its `externals` directory, used to execute JavaScript actions such as `actions/checkout`. That copy is independent of both `.nvmrc` and the system install, and moves only when the runner itself updates — which self-hosted runners do automatically.

## Keeping the OS patched

Security updates are applied automatically by `unattended-upgrades`, scheduled through
`/etc/apt/apt.conf.d/20auto-upgrades` — see [Basic Setup](basic-setup.md#5-enable-automatic-security-updates)
for the setup and what each setting does.

The failure mode worth knowing is that this mechanism goes quiet rather than loud. If the schedule
file is missing, `APT::Periodic::Unattended-Upgrade` defaults to off and nothing is ever installed,
yet `systemctl status unattended-upgrades` still reports the service as enabled and active — the
unit visible under systemd is a shutdown hook, not the upgrade run. The service therefore looks
healthy on a machine that has not taken a patch in years.

### Verifying that automatic updates actually run

Check the outcome, not the service state:
```
apt-get update && apt list --upgradable
```
A machine that is keeping up returns few or no entries. A long list means the automation is not
running, regardless of what systemd reports. Confirm the schedule and the timer directly:
```
apt-config dump | grep APT::Periodic
systemctl list-timers | grep apt-daily-upgrade
```
`APT::Periodic::Unattended-Upgrade` must read `"1"` and the timer must show a next run time.

Two further things can stall the run even once it is scheduled. An outdated `distro-info-data`
makes the script abort while trying to identify the release, which surfaces as
`Could not figure out development release`; installing that package on its own clears it. And
`unattended-upgrades` only draws from the origins listed in
`/etc/apt/apt.conf.d/50unattended-upgrades`, which by default covers the security pocket but not
the general updates pocket — so a handful of non-security packages legitimately linger.

To catch up a machine that has fallen behind, apply everything by hand. The config-preserving flags
matter here: without them a package upgrade can replace a customised config file, which for
`sshd_config` or the Nginx site config is how a maintenance window turns into an outage.
```
apt-get update
apt-get -y -o Dpkg::Options::=--force-confold -o Dpkg::Options::=--force-confdef upgrade
apt-get -y --purge autoremove
```
Plain `upgrade` never installs new packages, so a new kernel is held back and reported as
`not upgraded`. Pulling one in requires `full-upgrade` — see below.

### Applying a kernel update

Automatic reboots are deliberately disabled, so a new kernel is installed but never booted until
someone does it by hand. `/var/run/reboot-required` is what says one is pending.

A kernel arrives as a *new* package rather than an upgrade of an existing one, so it needs
`full-upgrade`. Because that verb is also allowed to remove packages, check what it intends to do
before running it — expect installs and zero removals:
```
apt-get -s full-upgrade | grep -E '^(Inst|Remv)'
apt-get -y -o Dpkg::Options::=--force-confold -o Dpkg::Options::=--force-confdef full-upgrade
```

Before rebooting, make sure the apps will come back. The PM2 boot unit resurrects whatever was in
its saved process list at the time of the last `pm2 save`, **not** whatever happens to be running
now — so an unsaved deployment is silently lost across a reboot:
```
pm2 save
systemctl is-enabled pm2-root
```
Confirm the previous kernel is still installed as a fallback, and that nothing is mid-install:
```
ls /boot/vmlinuz-*
dpkg --audit
```
Then reboot, and verify the runtime afterwards — the kernel moved, so this is also the moment a
stale PM2 daemon or a failed service would show itself:
```
systemctl reboot
```
```
uname -r
pm2 status
systemctl is-active nginx ssh fail2ban pm2-root
curl -s -o /dev/null -w '%{http_code}\n' https://app.thingspool.net/health
```

## Reclaiming disk space

Log growth is bounded at setup time — see [Basic Setup](basic-setup.md#10-bound-the-logs). On a
machine where those limits were applied late, the existing backlog is not removed retroactively and
has to be cleared once.

Check the usual accumulators first:
```
journalctl --disk-usage
du -sh /root/.pm2/logs /var/cache/apt
```

The journal honours a new ceiling only for future writes, so vacuum it down explicitly:
```
journalctl --vacuum-size=200M
```

The package cache refills on every upgrade and is safe to drop at any time:
```
apt-get clean
```

PM2's own logs need attention in two places. Files belonging to apps that no longer exist are never
touched by rotation and simply sit there, so delete those by name after confirming against
`pm2 status`. Already-rotated files can be compressed, which typically reclaims well over ninety
percent of their size:
```
gzip -f /root/.pm2/logs/*__*.log
```

Superseded kernels are removed automatically once
`Unattended-Upgrade::Remove-Unused-Kernel-Packages` is enabled. Packages left in the `rc` state —
removed, but with config files still on disk — are not covered by that and accumulate over a
machine's life:
```
dpkg -l | awk '/^rc/ {print $2}' | xargs -r dpkg --purge
```

## How to clean up unused Linux kernels

Normally this is handled automatically by `unattended-upgrades` (see
[Reclaiming disk space](#reclaiming-disk-space)). The manual procedure below is the fallback for a
machine where that was never enabled, or where a failed upgrade has left `/boot` full and dpkg in a
broken state.

1. Connect to the VPS via:
```
ssh root@222.239.251.208
```
(If the connection fails, check if your IP address isn't whitelisted in the VPS's inbound SSH rules - see [Inbound Rules](networking-and-security.md#inbound-rules-incoming-traffic-to-the-vps))

2. Check which kernel is currently running:
```
uname -r
```
The kernel being returned must NOT be removed.

3. List installed kernels:
```
dpkg -- list | grep linux-image
```

4. Among the listed kernels, remove the ones which are marked with either `ii` or `iF` and are NOT the currently running kernel.
```
sudo apt purge [List of kernels to remove, separated by blank space]
```
If this fails due to dependency issues, try the command below:
```
sudo dpkg --purge --force-depends [List of kernels to remove as well as all related linux modules, separated by blank space]
```

5. Clean up the associated modules and headers. (Note: It is a good practice to periodically run the command below to clean up the space)
```
sudo apt autoremove --purge
```
This command may fail. If that turns out to be the case, run step 5, 6, and 7 first and then come back and execute this step.

6. Verify that `/boot` has free space now.
```
df -h /boot
```

7. Fix any broken packages from the failed upgrade.
```
sudo dpkg --configure -a
sudo apt install -f
```
If `sudo dpkg --configure -a` fails, run `sudo apt install -f` first.

8. Re-sync the versions.
```
sudo apt update && sudo apt upgrade
```

9. Reboot (since a new kernel was installed).
```
sudo reboot
```
