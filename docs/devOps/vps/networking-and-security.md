# VPS Networking & Security

> Part of the [VPS Hosting Guide](./) — see also: [Basic Setup](basic-setup.md), [Deployment](deployment.md), [Maintenance](maintenance.md)

## Firewall rules for the VPS

Configure these inbound/outbound rules in the VPS hosting provider's firewall settings.

### Inbound rules (incoming traffic to the VPS)

| Protocol | Port | Source | Purpose |
|----------|------|--------|---------|
| SSH (TCP) | 22 | Your IP only | Remote administration. Restricting to your IP blocks brute-force attacks entirely. If your IP changes frequently, whitelist a small CIDR range from your ISP instead. |
| HTTP (TCP) | 80 | All IPs | Web traffic. Nginx redirects HTTP to HTTPS, and Certbot uses port 80 for certificate renewal challenges. |
| HTTPS (TCP) | 443 | All IPs | Web traffic for the live and staging apps. |

All other inbound ports should be blocked.

### Outbound rules (traffic from the VPS to the outside)

| Protocol | Port | Destination | Purpose |
|----------|------|-------------|---------|
| HTTPS (TCP) | 443 | All IPs | Firebase API calls, npm registry, Certbot, GitHub Actions runner communication. |
| HTTP (TCP) | 80 | All IPs | Package downloads, Certbot HTTP challenges. |
| DNS (UDP) | 53 | All IPs | Domain name resolution. |
| DNS (TCP) | 53 | All IPs | DNS fallback for large responses (e.g. DNSSEC). |

### Note on GitHub Actions deployments

The self-hosted runner on the VPS communicates with GitHub via an **outbound** HTTPS connection (port 443). GitHub does not need to SSH into the VPS. This means restricting inbound SSH to your IP only will **not** break the deployment pipeline.

## Nginx setup for the VPS

1. Make sure that Nginx is installed and running (see [Basic Setup](basic-setup.md) step 5).

2. Navigate to the project's root directory and run the following command:
```
npm run nginx:update
```
This will apply the latest Nginx config files in `/dev/config/` to the VPS, and restart Nginx.

## DNS/SSL setup for the VPS

1. Make sure that Certbot is installed (see [Basic Setup](basic-setup.md) step 6).

2. Make sure that the DNS A record is configured in the following way:
    - `app.thingspool.net` points to `222.239.251.208`
    - `staging.thingspool.net` points to `222.239.251.208`

3. Make sure that the SSL certificates are set up:
```
ssh root@222.239.251.208 "certbot --nginx -d app.thingspool.net"
ssh root@222.239.251.208 "certbot --nginx -d staging.thingspool.net"
```
If the above commands fail due to the absence of the referenced SSL certificates in the Nginx config, run the commands shown below (to generate placeholder certificates) and then run the above commands again to overwrite them with proper ones (i.e. ones which belong to Nginx and thus auto-renew when expired).
```
ssh root@222.239.251.208 "systemctl stop nginx && certbot certonly --standalone -d app.thingspool.net && systemctl start nginx"
ssh root@222.239.251.208 "systemctl stop nginx && certbot certonly --standalone -d staging.thingspool.net && systemctl start nginx"
```

4. If you want to verify that the SSL certificates will auto-renew, run:
```
ssh root@222.239.251.208 "certbot renew --dry-run -v 2>&1"
```
If it prints out `Congratulations, all simulated renewals succeeded` for both domains, you are good. If it hangs forever, exit the process by pressing Ctrl+C and then kill the idle process by running:
```
ssh root@222.239.251.208 "pkill -f certbot"
```

## Firebase Admin SDK Credentials setup for the VPS

1. Make sure that there is a service account for Firebase.

2. Make sure that this service account has the following roles:
    - `Datastore User`
    - `Object Admin`
    - `Secret Manager Secret Accessor`

3. Go to `Firebase Console -> Project settings -> Service accounts -> Firebase Admin SDK` and click `Generate new private key` to download a new JSON file.

4. Change this JSON file's name to `sevice-account-key.json`.

5. Open up the terminal and navigate to where this JSON file is saved.

6. Run the following commands:
```
scp ./service-account-key.json root@222.239.251.208:/root/service-account-key.json
ssh root@222.239.251.208 "chmod 600 /root/service-account-key.json"
```
