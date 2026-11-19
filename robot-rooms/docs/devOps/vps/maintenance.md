# VPS Maintenance

> VPS Hosting Guide: [Basic Setup](basic-setup.md) · [Networking & Security](networking-and-security.md) · [Deployment](deployment.md)

## How to upgrade the Node.js version
`.nvmrc` is the source of truth: CI reads it, and every deploy checks the VPS runtime against it. The VPS is upgraded by hand. **The PM2 daemon launches apps with the `node` it started with**, so installing a new Node.js does nothing until `pm2 update` respawns the daemon.

1. In the repo, update `.nvmrc`, `engines.node` and `@types/node`. Switch your machine over ([below](#switching-your-own-machine-over)) and reinstall the global CLIs ([below](#global-clis-do-not-survive-a-nodejs-switch)).
2. On the VPS (replace `24` with the new major):
```
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
node -v && which -a node      # must be the new version, and the only node
pm2 update
pm2 status && pm2 jlist | grep -o '"node_version":"[^"]*"'
```
3. Check the runner's PATH ([below](#the-self-hosted-runner-and-nodejs)).
4. **Push last**: `npm run beforeCommit`, then commit and push. A push made before the VPS upgrade fails the deploy's "Verify runtime Node.js version" step, and e2e is skipped.

### Switching your own machine over
```
nvm install && nvm use && nvm alias default 24 && node -v
```
`nvm alias default` is required, because the pre-commit check runs in new shells. Editors capture the environment at launch, so **fully quit and restart the editor** (reloading the window is not enough).

### Global CLIs do not survive a Node.js switch
nvm keeps a separate global prefix per version, so `firebase` and `pm2` disappear from `PATH` after a switch. `npm run dev` runs under `concurrently -k`, so one missing CLI kills the whole command during startup. Fix:
```
npm install -g firebase-tools pm2
command -v firebase pm2
```
Removing nvm from the VPS strands global packages the same way.

### Keep a single Node.js on the VPS
Only the NodeSource system Node.js may exist, and `which -a node` must list one path. nvm loads from the shell profile, which systemd and the runner never read, so interactive shells and automation silently disagree about the version. To remove nvm: note its global packages, delete its directory and profile lines, open a new shell, reinstall the packages (especially PM2) with the system npm, and run `pm2 update`.

### The self-hosted runner and Node.js
The runner passes the `PATH` stored in its `.path` and `.env` files, captured when `config.sh` ran. Neither file should contain a versioned Node.js directory:
```
cat /root/actions-runner/.path /root/actions-runner/.env
cd /root/actions-runner && ./svc.sh stop && ./svc.sh start   # after editing
```
The runner's bundled Node.js (under `externals`, used for JS actions) updates with the runner and is independent of `.nvmrc`.

## Keeping the OS patched
`unattended-upgrades` applies security updates (see [basic-setup.md](basic-setup.md#5-enable-automatic-security-updates)). **It fails silently**: without the schedule file nothing ever installs, while `systemctl` still reports the service as active (that unit is only a shutdown hook).

### Verifying that automatic updates actually run
Judge by the outcome:
```
apt-get update && apt list --upgradable        # a long list means it is not running
apt-config dump | grep APT::Periodic           # Unattended-Upgrade "1"
systemctl list-timers | grep apt-daily-upgrade # has a next run
```
- `Could not figure out development release` means `distro-info-data` needs installing.
- Only the security pocket is enabled by default, so some non-security packages remain pending.

Manual catch-up (always keep existing configs):
```
apt-get update
apt-get -y -o Dpkg::Options::=--force-confold -o Dpkg::Options::=--force-confdef upgrade
apt-get -y --purge autoremove
```

### Applying a kernel update
**Human-only, never automated.** `/var/run/reboot-required` marks a pending reboot. New kernels need `full-upgrade`, so preview it first and expect zero removals:
```
apt-get -s full-upgrade | grep -E '^(Inst|Remv)'
apt-get -y -o Dpkg::Options::=--force-confold -o Dpkg::Options::=--force-confdef full-upgrade
pm2 save && systemctl is-enabled pm2-root   # PM2 resurrects only the saved list
ls /boot/vmlinuz-* && dpkg --audit          # fallback kernel present, nothing half-installed
systemctl reboot
```
After the reboot:
```
uname -r
pm2 status
systemctl is-active nginx ssh fail2ban pm2-root
curl -s -o /dev/null -w '%{http_code}\n' https://app.thingspool.net/health
```

## Reclaiming disk space
Log limits from [basic-setup.md](basic-setup.md#10-bound-the-logs) do not clear an existing backlog.
```
journalctl --disk-usage && du -sh /root/.pm2/logs /var/cache/apt
journalctl --vacuum-size=200M
apt-get clean
gzip -f /root/.pm2/logs/*__*.log                          # rotated logs not yet compressed
dpkg -l | awk '/^rc/ {print $2}' | xargs -r dpkg --purge  # leftover configs of removed packages
```
- Delete the logs of PM2 apps that no longer exist by name, after checking `pm2 status`.
- Tools that read log history must read `.log.gz` files as well as `.log`.

## How to clean up unused Linux kernels
A fallback for when automatic kernel cleanup was never enabled, or `/boot` is full and dpkg is broken.
1. `ssh root@222.239.251.208`
2. `uname -r`. **Never remove the running kernel.**
3. `dpkg --list | grep linux-image`
4. Purge the other kernels marked `ii` or `iF`: `sudo apt purge <kernels...>`. If dependencies fail, use `sudo dpkg --purge --force-depends <kernels and their modules...>`.
5. `sudo apt autoremove --purge`. If it fails, do steps 6–7 first and then come back.
6. `df -h /boot` to confirm there is free space.
7. Fix broken packages with `sudo dpkg --configure -a` and `sudo apt install -f`. If the first fails, run the second first.
8. `sudo apt update && sudo apt upgrade`
9. `sudo reboot`
