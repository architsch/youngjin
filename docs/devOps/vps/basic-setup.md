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

### 2. Update system packages

```
apt update && apt upgrade -y
```

### 3. Secure SSH access

Disable password-based login and allow key-only authentication:
```
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd
```
Make sure your SSH public key is already in `/root/.ssh/authorized_keys` before doing this, otherwise you will be locked out.

### 4. Install fail2ban

```
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```
This automatically blocks IPs that repeatedly fail SSH login attempts.

### 5. Install Nginx

```
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```
Verify it is running:
```
systemctl status nginx
```

### 6. Install Certbot (for SSL certificates)

```
apt install -y certbot python3-certbot-nginx
```
Verify it is installed:
```
certbot --version
```

### 7. Install Node.js

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
```
Verify the version:
```
node -v
npm -v
```

### 8. Install PM2 (process manager)

```
npm install -g pm2
```
Enable PM2 to start on boot so that the app processes survive reboots:
```
pm2 startup
```

### 9. Install Git

Git is usually pre-installed on Ubuntu, but verify:
```
git --version
```
If not installed:
```
apt install -y git
```

### 10. Configure firewall rules

Set up the inbound/outbound rules in your VPS hosting provider's firewall settings as described in the [Firewall rules](networking-and-security.md#firewall-rules-for-the-vps) section.

### 11. Set up the self-hosted GitHub Actions runner

Follow the steps in the [Self-hosted GitHub Actions runner setup](deployment.md#self-hosted-github-actions-runner-setup-for-the-vps) section.

### 12. Set up Nginx config

Follow the steps in the [Nginx setup](networking-and-security.md#nginx-setup-for-the-vps) section.

### 13. Set up DNS and SSL certificates

Follow the steps in the [DNS/SSL setup](networking-and-security.md#dnsssl-setup-for-the-vps) section.

### 14. Upload Firebase Admin SDK credentials

Follow the steps in the [Firebase Admin SDK Credentials setup](networking-and-security.md#firebase-admin-sdk-credentials-setup-for-the-vps) section.

### 15. Deploy the app

Trigger a deployment by pushing to the `main` branch, or manually trigger the staging workflow from GitHub's Actions tab. Then promote to live via the promote workflow.
