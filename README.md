# Local Dev Test

## Prerequisite

1. Log into Google Cloud by running the following command. This will allow `devRunner.js` to fetch secrets from Google Secret Manager based on the local credentials.
```
gcloud auth application-default login
```

2. Run one of the following commands:
    - `npm run dev` - for full development test
    - `npm run devcss` - for testing the CSS only
    - `npm run devclient` - for testing the client only
    - `npm run devserver` - for testing the server only
    - `npm run devnossg` - for full development test except the SSG

# VPS Deployment Management

- Note 1: `222.239.251.208` is the VPS's IP address.
- Note 2: It is assumed that the VPS run on Ubuntu 22.04.5 LTS, as well as that HTTPS is enabled via an SSL certificate.

## How to upload the Firebase Admin SDK credentials to the VPS

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

## How to update the VPS's Nginx

1. Update the `nginx_default.txt` file located at the project root directory.

2. Open up the terminal and navigate to the project root directory.

3. Run the following commands:
```
scp ./nginx_default.txt root@222.239.251.208:/etc/nginx/sites-available/default
ssh root@222.239.251.208 "nginx -t && systemctl reload nginx"
```

## How to verify that the server has been deployed to the VPS successfully

1. Push the current project to the remote GitHub repository's `main` branch.

2. This will make GitHub auto-deploy the server app to the VPS.

3. Open up the terminal, and run the following commands:
```
ssh root@222.239.251.208
pm2 logs admin --lines 30   # Look for "[bootstrap] Secret loaded" messages
curl http://localhost:3000/  # Should return "Server is running"
```
4. Open up the browser, visit `https://app.thingspool.net/mypage`, and verify that the browser's console log prints out the following message:
```
Successfully connected to game_sockets (transport: websocket)
```

## How to clean up unused Linux kernels

1. Check which kernel is currently running:
```
uname -r
```
The kernel being returned must NOT be removed.

2. List installed kernels:
```
dpkg -- list | grep linux-image
```

3. Among the listed kernels, remove the ones which are marked with either `ii` or `iF` and are NOT the currently running kernel.
```
sudo apt purge [List of kernels to remove, separated by blank space]
```
If this fails due to dependency issues, try the command below:
```
sudo dpkg --purge --force-depends [List of kernels to remove as well as all related linux modules, separated by blank space]

```

4. Clean up associated modules and headers. (Note: It is a good practice to periodically run the command below to clean up the space)
```
sudo apt autoremove --purge
```
This command may fail. If that turns out to be the case, run step 5, 6, and 7 first and then come back and execute this step.

5. Verify that `/boot` has free space now.
```
df -h /boot
```

6. Fix any broken packages from the failed upgrade.
```
sudo dpkg --configure -a
sudo apt install -f
```
If `sudo dpkg --configure -a` fails, run `sudo apt install -f` first.

7. Re-sync the versions.
```
sudo apt update && sudo apt upgrade
```

8. Reboot (since a new kernel was installed).
```
sudo reboot
```