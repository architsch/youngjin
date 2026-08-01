# VPS Basic Setup

> Part of the [VPS Hosting Guide](./) — see also: [Networking & Security](networking-and-security.md), [Deployment](deployment.md), [Maintenance](maintenance.md)

## Important Notes

- `222.239.251.208` is the VPS's IP address.
- It is assumed that the VPS runs on Ubuntu 22.04.5 LTS, as well as that HTTPS is enabled via SSL certificates.
- File permission issues may occur when the browser tries to fetch files (e.g. client app bundle, CSS file, etc) from the VPS. In that case, enter the VPS's terminal via SSH and run the following command to grant access permission:
```
chmod o+x /root /root/actions-runner /root/actions-runner/_work /root/actions-runner/_work/youngjin /root/actions-runner/_work/youngjin/youngjin /root/actions-runner/_work/youngjin/youngjin/dist /root/actions-runner/_work/youngjin/youngjin/dist/client
```

## Initial VPS setup (starting from scratch)

This section covers the full setup process for a fresh Ubuntu VPS. All commands below assume you are connected via SSH as root.

### 1. Connect to the VPS

```
ssh root@222.239.251.208
```
(If the connection fails, check if your IP address isn't whitelisted in the VPS's inbound SSH rules - see [Inbound Rules](networking-and-security.md#inbound-rules-incoming-traffic-to-the-vps))

### 2. Update system packages

```
apt update && apt upgrade -y
```

### 3. Secure SSH access

Make sure your SSH public key is already in `/root/.ssh/authorized_keys` before doing this, otherwise you will be locked out.

Write the hardening into a drop-in file rather than editing `/etc/ssh/sshd_config` directly:
```
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<EOF
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
EOF
```
The stock `sshd_config` pulls in `/etc/ssh/sshd_config.d/*.conf` near the top of the file, and sshd
takes the **first** value it sees for each keyword. A drop-in is therefore read before — and wins
over — the permissive defaults further down the stock file, and it survives an `openssh-server`
package upgrade untouched. Editing the stock file in place is fragile by comparison: the same
setting can already appear later in the file, so the edit lands but has no effect.

Validate the syntax, then reload. Reloading keeps existing sessions alive, so a mistake does not
disconnect you on the spot:
```
sshd -t && systemctl reload ssh
```

Verify what sshd is *actually* enforcing — not what the config files say. This step is the one that
matters, because a hardening edit that silently failed to apply looks identical to one that worked:
```
sshd -T | grep -iE '^(passwordauthentication|permitrootlogin|pubkeyauthentication)'
```
Expect `passwordauthentication no`, `permitrootlogin without-password`, and
`pubkeyauthentication yes`. Confirm key-based login still works by opening a **second** terminal and
connecting again before you close the current session.

### 4. Install fail2ban

```
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```
This automatically blocks IPs that repeatedly fail SSH login attempts.

### 5. Enable automatic security updates

Installing `unattended-upgrades` is not enough to make it run — the periodic schedule lives in a
separate file that does not exist by default. Without it the service still reports itself as
enabled and active, because the unit that shows up under systemd is a shutdown hook rather than the
upgrade run. Create the schedule explicitly:
```
apt install -y unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
```

Let it clean up after itself, so that superseded kernels do not accumulate until `/boot` fills:
```
sed -i 's|^//Unattended-Upgrade::Remove-Unused-Kernel-Packages.*|Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";|' /etc/apt/apt.conf.d/50unattended-upgrades
sed -i 's|^//Unattended-Upgrade::Remove-New-Unused-Dependencies.*|Unattended-Upgrade::Remove-New-Unused-Dependencies "true";|' /etc/apt/apt.conf.d/50unattended-upgrades
```

Automatic reboots are deliberately left off, so a kernel update never restarts the app on its own —
see [Applying a kernel update](maintenance.md#applying-a-kernel-update) for the manual step.

Verify the schedule is actually in effect, then confirm it can plan a run:
```
apt-config dump | grep APT::Periodic
systemctl list-timers | grep apt-daily-upgrade
```
`APT::Periodic::Unattended-Upgrade` must read `"1"`, and the timer must show a next run time. See
[Keeping the OS patched](maintenance.md#keeping-the-os-patched) for how to audit this later.

### 6. Install Nginx

```
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```
Verify it is running:
```
systemctl status nginx
```

### 7. Install Certbot (for SSL certificates)

```
apt install -y certbot python3-certbot-nginx
```
Verify it is installed:
```
certbot --version
```

### 8. Install Node.js

The repository's `.nvmrc` is the single source of truth for the Node.js major version — install
the major it names (currently `24`), so the VPS matches CI and local development.

```
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
```
Verify that the version reported is the one just installed, and that nothing else provides `node`:
```
node -v
npm -v
which -a node
```
`which -a node` must list only the system install. Do not install nvm on the VPS, and remove it if
present — see [Keep a single Node.js on the VPS](maintenance.md#keep-a-single-nodejs-on-the-vps).

To change the version later, follow [Upgrading Node.js](maintenance.md#how-to-upgrade-the-nodejs-version) —
installing a new Node.js on its own does **not** move the already-running app processes onto it.

### 9. Install PM2 (process manager)

```
npm install -g pm2
```
Enable PM2 to start on boot so that the app processes survive reboots:
```
pm2 startup systemd
```
Once the apps have been deployed, record them into that unit with `pm2 save`. Confirm the unit
actually exists — without it the apps are lost on the next reboot, which stays invisible until one
happens:
```
systemctl is-enabled pm2-root
```
The generated unit hardcodes the path to the PM2 executable, so if PM2 is ever reinstalled elsewhere
the unit must be regenerated with `pm2 unstartup systemd` followed by `pm2 startup systemd`.

### 10. Bound the logs

Neither the system journal nor PM2 limits its own log growth out of the box, and on a small disk
both will happily consume several gigabytes over the life of the machine. Cap both at install time.

The journal takes a size ceiling in its own config:
```
cat > /etc/systemd/journald.conf <<EOF
[Journal]
SystemMaxUse=200M
SystemKeepFree=1G
SystemMaxFileSize=50M
MaxRetentionSec=1month
EOF
systemctl restart systemd-journald
```

PM2 has no rotation at all until its rotation module is installed — the per-app `out` and `error`
files simply grow forever:
```
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
```
Note that this module runs as a PM2 process of its own and so carries a small resident memory cost,
which is worth knowing on a memory-constrained box.

To reclaim space on a machine where these limits were applied late, see
[Reclaiming disk space](maintenance.md#reclaiming-disk-space).

### 11. Install Git

Git is usually pre-installed on Ubuntu, but verify:
```
git --version
```
If not installed:
```
apt install -y git
```

### 12. Configure firewall rules

Set up the inbound/outbound rules in your VPS hosting provider's firewall settings as described in the [Firewall rules](networking-and-security.md#firewall-rules-for-the-vps) section.

### 13. Set up the self-hosted GitHub Actions runner

Follow the steps in the [Self-hosted GitHub Actions runner setup](deployment.md#self-hosted-github-actions-runner-setup-for-the-vps) section.

### 14. Set up Nginx config

Follow the steps in the [Nginx setup](networking-and-security.md#nginx-setup-for-the-vps) section.

### 15. Set up DNS and SSL certificates

Follow the steps in the [DNS/SSL setup](networking-and-security.md#dnsssl-setup-for-the-vps) section.

### 16. Upload Firebase Admin SDK credentials

Follow the steps in the [Firebase Admin SDK Credentials setup](networking-and-security.md#firebase-admin-sdk-credentials-setup-for-the-vps) section.

### 17. Deploy the app

Trigger a deployment by pushing to the `main` branch, or manually trigger the staging workflow from GitHub's Actions tab. Then promote to live via the promote workflow.
