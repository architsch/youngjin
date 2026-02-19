# Local Development Run

## Prerequisite

1. Log into Google Cloud by running the following command. This will allow `devRunner.js` to fetch secrets from Google Secret Manager based on the local credentials.
```
gcloud auth application-default login
```

## How to Run the Project Locally

1. Open up the terminal and navigate to the project's root directory.

2. Run one of the following commands:
    - `npm run dev` - for full development test
    - `npm run devcss` - for testing the CSS only
    - `npm run devclient` - for testing the client only
    - `npm run devserver` - for testing the server only
    - `npm run devnossg` - for full development test except the SSG

3. If you want to terminate the local instance, press `Ctrl+C` to exit the inner console and then run `npm stop` to terminate the PM2 process.

# VPS Deployment Management

## Important Notes

- `222.239.251.208` is the VPS's IP address.
- It is assumed that the VPS runs on Ubuntu 22.04.5 LTS, as well as that HTTPS is enabled via SSL certificates.

## Workflows

- `.github/workflows/deploy-staging.yml` - Workflow for automatically deploying the app bundles to the VPS whenever "git push" happens.
- `.github/workflows/promote-live.yml` - Workflow for applying the staging apps to the live apps.
- `.github/workflows/rollback-live.yml` - Workflow for rolling back the latest live apps to their previous backup copies (in case the latest ones happen to be problematic).

## Nginx setup for the VPS

1. Make sure that Nginx is installed and is currently running inside the VPS.

2. Navigate to the project's root directory and run the following command:
```
npm run nginx:update
```
This will apply the latest Nginx config files in `/dev/config/` to the VPS, and restart Nginx.

## DNS/SSL setup for the VPS

1. Make sure that Certbot is installed inside the VPS.

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

## How to clean up unused Linux kernels

1. Connect to the VPS via:
```
ssh root@222.239.251.208
```

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