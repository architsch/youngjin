# VPS Basic Setup

> VPS Hosting Guide: [Networking & Security](networking-and-security.md) · [Deployment](deployment.md) · [Maintenance](maintenance.md)

## Important Notes
- VPS IP: `222.239.251.208`, running Ubuntu 22.04 LTS with HTTPS.
- If the browser cannot fetch bundles because of file permissions:
```
chmod o+x /root /root/actions-runner /root/actions-runner/_work /root/actions-runner/_work/youngjin /root/actions-runner/_work/youngjin/youngjin /root/actions-runner/_work/youngjin/youngjin/dist /root/actions-runner/_work/youngjin/youngjin/dist/client
```

## Initial VPS setup
All commands run as root over SSH.

### 1. Connect
```
ssh root@222.239.251.208
```
If this fails, check that your IP is allowed by the [inbound rules](networking-and-security.md#inbound-rules-incoming-traffic-to-the-vps).

### 2. Update packages
```
apt update && apt upgrade -y
```

### 3. Secure SSH access
Confirm your key is in `/root/.ssh/authorized_keys` first. Use a drop-in file, because sshd takes the **first** value it reads and drop-ins are read before the stock config:
```
cat > /etc/ssh/sshd_config.d/99-hardening.conf <<EOF
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
EOF
sshd -t && systemctl reload ssh
sshd -T | grep -iE '^(passwordauthentication|permitrootlogin|pubkeyauthentication)'
```
Expect `no` / `without-password` / `yes`. Test a login from a second terminal before closing the first.

### 4. Install fail2ban
```
apt install -y fail2ban && systemctl enable --now fail2ban
```

### 5. Enable automatic security updates
Installing the package alone does **not** schedule runs. The periodic config must be created explicitly:
```
apt install -y unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<EOF
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
sed -i 's|^//Unattended-Upgrade::Remove-Unused-Kernel-Packages.*|Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";|' /etc/apt/apt.conf.d/50unattended-upgrades
sed -i 's|^//Unattended-Upgrade::Remove-New-Unused-Dependencies.*|Unattended-Upgrade::Remove-New-Unused-Dependencies "true";|' /etc/apt/apt.conf.d/50unattended-upgrades
apt-config dump | grep APT::Periodic
systemctl list-timers | grep apt-daily-upgrade
```
Automatic reboots stay off (see [Applying a kernel update](maintenance.md#applying-a-kernel-update)).

### 6. Install Nginx
```
apt install -y nginx && systemctl enable --now nginx
```

### 7. Install Certbot
```
apt install -y certbot python3-certbot-nginx
```

### 8. Install Node.js
Install the major version named in `.nvmrc`:
```
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
node -v && which -a node
```
`which -a node` must list only the system install. Never use nvm on the VPS (see [Keep a single Node.js on the VPS](maintenance.md#keep-a-single-nodejs-on-the-vps)). Upgrades follow [How to upgrade the Node.js version](maintenance.md#how-to-upgrade-the-nodejs-version).

### 9. Install PM2
```
npm install -g pm2
pm2 startup systemd
systemctl is-enabled pm2-root
```
Run `pm2 save` after the apps are deployed. If PM2 is reinstalled at a different path, regenerate the unit with `pm2 unstartup systemd && pm2 startup systemd`.

### 10. Bound the logs
Neither journald nor PM2 caps its logs by default:
```
cat > /etc/systemd/journald.conf <<EOF
[Journal]
SystemMaxUse=200M
SystemKeepFree=1G
SystemMaxFileSize=50M
MaxRetentionSec=1month
EOF
systemctl restart systemd-journald
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 5
pm2 set pm2-logrotate:compress true
```
See also [Reclaiming disk space](maintenance.md#reclaiming-disk-space).

### 11. Install Git
```
git --version || apt install -y git
```

### 12–16. Remaining setup
12. [Firewall rules](networking-and-security.md#firewall-rules-for-the-vps)
13. [Self-hosted GitHub Actions runner](deployment.md#self-hosted-github-actions-runner-setup-for-the-vps)
14. [Nginx config](networking-and-security.md#nginx-setup-for-the-vps)
15. [DNS and SSL](networking-and-security.md#dnsssl-setup-for-the-vps)
16. [Firebase Admin SDK credentials](networking-and-security.md#firebase-admin-sdk-credentials-setup-for-the-vps)

### 17. Deploy
Push to `main` (or dispatch the staging workflow), then run the promote workflow.
