# VPS Networking & Security

> VPS Hosting Guide: [Basic Setup](basic-setup.md) · [Deployment](deployment.md) · [Maintenance](maintenance.md) · [Firebase & Google Cloud](../firebase.md)

## Firewall rules for the VPS
Configure these in the hosting provider's firewall.

### Inbound rules (incoming traffic to the VPS)
| Protocol | Port | Source | Purpose |
|---|---|---|---|
| TCP (SSH) | 22 | your IP (or a small ISP CIDR) | administration |
| TCP (HTTP) | 80 | all | HTTPS redirect, Certbot challenges |
| TCP (HTTPS) | 443 | all | live and staging apps |

Block everything else. The Actions runner connects **outbound**, so restricting SSH does not affect deploys.

### Outbound rules (traffic from the VPS to the outside)
| Protocol | Port | Purpose |
|---|---|---|
| TCP | 443 | Firebase, npm, Certbot, GitHub runner |
| TCP | 80 | package downloads, Certbot |
| UDP / TCP | 53 | DNS |

## Nginx setup for the VPS
From the project root, run `npm run nginx:update`. It copies the Nginx configs in `dev/config/` to the VPS, then tests and reloads Nginx (a reload, not a restart, so live connections survive). **No deployment workflow does this**, so a config change reaches the server only when someone runs it.

## DNS/SSL setup for the VPS
1. DNS A records: `app.thingspool.net` and `staging.thingspool.net` both point to `222.239.251.208`.
2. Issue certificates:
```
ssh root@222.239.251.208 "certbot --nginx -d app.thingspool.net"
ssh root@222.239.251.208 "certbot --nginx -d staging.thingspool.net"
```
If this fails because the Nginx config references certificates that do not exist yet, create placeholder certificates first and then rerun the commands above:
```
ssh root@222.239.251.208 "systemctl stop nginx && certbot certonly --standalone -d app.thingspool.net && systemctl start nginx"
ssh root@222.239.251.208 "systemctl stop nginx && certbot certonly --standalone -d staging.thingspool.net && systemctl start nginx"
```
3. Check renewal with `ssh root@222.239.251.208 "certbot renew --dry-run -v 2>&1"`. If it hangs, stop it and run `pkill -f certbot`.

## Firebase Admin SDK Credentials setup for the VPS
1. The service account `firebase-adminsdk-fbsvc@thingspool.iam.gserviceaccount.com` must hold only the runtime roles in [firebase.md](../firebase.md#iam-roles).
2. Firebase Console → Project settings → Service accounts → **Generate new private key**. Save the file as `service-account-key.json`.
3. Upload it:
```
scp ./service-account-key.json root@222.239.251.208:/root/service-account-key.json
ssh root@222.239.251.208 "chmod 600 /root/service-account-key.json"
```
