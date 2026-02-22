# VPS Maintenance

> Part of the [VPS Hosting Guide](./) — see also: [Basic Setup](basic-setup.md), [Networking & Security](networking-and-security.md), [Deployment](deployment.md)

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
