# VPS Maintenance

> Part of the [VPS Hosting Guide](./) — see also: [Basic Setup](basic-setup.md), [Networking & Security](networking-and-security.md), [Deployment](deployment.md)

## How to upgrade the Node.js version

`.nvmrc` in the repository root is the single source of truth. CI reads it through `actions/setup-node`, and every deployment asserts the VPS runtime against it. The VPS is the one place that cannot read it automatically, so it is upgraded by hand.

The subtlety worth knowing: the PM2 daemon spawns app processes with the `node` it inherited when the daemon itself started. Installing a newer Node.js does **not** move the running apps onto it — the daemon has to be respawned as well, which is what `pm2 update` does.

1. In the repository, set `.nvmrc` and package.json's `engines.node` to the new major, and bump `@types/node` to match. Switch your own machine over — see [Switching your own machine over](#switching-your-own-machine-over) — then run `npm install -g pm2` if you want your local PM2 on the new runtime.

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

## How to clean up unused Linux kernels

1. Connect to the VPS via:
```
ssh root@222.239.251.208
```
(If the connection fails, check if your IP address isn't whitelisted in the VPS's inbound SSH rules - see [Inbound Rules](networking-and-security.md#inbound_rules_incoming_traffic_to_the_VPS))

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
