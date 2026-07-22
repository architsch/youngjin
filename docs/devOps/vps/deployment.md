# VPS Deployment

> Part of the [VPS Hosting Guide](./) — see also: [Basic Setup](basic-setup.md), [Networking & Security](networking-and-security.md), [Maintenance](maintenance.md), [Firebase & Google Cloud](../firebase.md)

## Self-hosted GitHub Actions runner setup for the VPS

This section explains how to set up a self-hosted GitHub Actions runner on the VPS, which allows GitHub workflows to execute directly on the VPS without needing inbound SSH access from GitHub.

1. Connect to the VPS via SSH:
```
ssh root@222.239.251.208
```
(If the connection fails, check if your IP address isn't whitelisted in the VPS's inbound SSH rules - see [Inbound Rules](networking-and-security.md#inbound_rules_incoming_traffic_to_the_VPS))

2. Create a directory for the runner:
```
mkdir -p /root/actions-runner && cd /root/actions-runner
```

3. Download the latest GitHub Actions runner package. Check the [GitHub Actions runner releases page](https://github.com/actions/runner/releases) for the latest version and replace the URL accordingly (Warning: The number `2.321.0` is just a placeholder; it may differ based on the action runner's latest version.):
```
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
```

4. Go to the GitHub repository's `Settings -> Actions -> Runners -> New self-hosted runner`. Copy the token shown in the configuration command, and run:
```
./config.sh --url https://github.com/<OWNER>/<REPO> --token <TOKEN>
```
Accept the defaults when prompted (or customize the runner name/labels as needed).

5. Install and start the runner as a system service so it persists across reboots:
```
./svc.sh install
./svc.sh start
```

6. Verify the runner is active:
```
./svc.sh status
```
You should also see the runner listed as "Idle" in the repository's `Settings -> Actions -> Runners` page.

7. Make sure Node.js and PM2 are installed on the VPS (see [Basic Setup](basic-setup.md) steps 7–8).

8. The workflows (defined in `.github/workflows/`) use `runs-on: self-hosted` to target this runner. Once the runner is active, any push to `main` will trigger the staging deployment workflow, and the promote/rollback workflows can be triggered manually via GitHub's UI.

### Troubleshooting the runner

- **Check runner logs**: `journalctl -u actions.runner.<OWNER>-<REPO>.<RUNNER_NAME>.service -f`
- **Restart the runner**: `cd /root/actions-runner && ./svc.sh stop && ./svc.sh start`
- **Re-register the runner**: If the runner becomes stale, remove it with `./config.sh remove --token <TOKEN>` and repeat step 4 onwards.
- **File permission issues**: If the browser cannot fetch files served by Nginx from the runner's working directory, see the `chmod` command in the [Important Notes](basic-setup.md#important-notes) section.

## Firestore Composite Indexes

`firestore.indexes.json` defines the composite indexes required by the server's Firestore queries (e.g. the stale-guest cleanup query filters on `userType` equality plus a `lastLoginAt` range, which Firestore can only serve with a composite index).

Important details:

- **Composite indexes match by collection ID.** The staging server stores its data in `staging_`-prefixed collections within the same Firebase project as the live server, so every composite index needed by the live (unprefixed) collections must have a twin entry for its `staging_`-prefixed counterpart. An index defined only for `users` does nothing for `staging_users`.
- **Indexes are deployed manually, not by CI.** No workflow touches Firebase. After editing `firestore.indexes.json`, deploy it from a dev machine:
  ```
  firebase deploy --only firestore:indexes
  ```
  The project is taken from `.firebaserc`, and the credentials from `gcloud auth application-default login`. This never deletes indexes that exist in the Firebase console but are absent from the file (firebase-tools requires `--force` for deletions). If the deploy fails with a `403`, see [Firebase & Google Cloud → IAM roles](../firebase.md#iam-roles) and its [Troubleshooting](../firebase.md#troubleshooting) table.
- **A deploy is project-wide.** Because live and staging share one Firebase project, deploying reconciles the entire file — both the live (`users`) and staging (`staging_`-prefixed) entries — so it affects both environments at once. Deploy before shipping code that depends on a new index, and confirm in the Firebase console that the index has finished building: index creation is asynchronous, and queries needing it keep failing until it is enabled.
- **A missing index announces itself in the logs.** Queries that depend on a composite index log a distinct error when they fail, so a forgotten deploy surfaces in the process logs rather than silently returning nothing.
- **The Firestore emulator does not enforce composite indexes**, so a missing index never reproduces in local dev — the affected queries only start failing (with `FAILED_PRECONDITION`) against the real Firestore backend. If a server-side query silently returns no results in staging/live but works locally, check the process logs for "DB Query Error" and verify the index exists in the Firebase console (`Firestore -> Indexes`).

## Workflows

- `.github/workflows/deploy-staging.yml` - Workflow for automatically deploying the app bundles to the VPS whenever "git push" happens.
- `.github/workflows/promote-live.yml` - Workflow for applying the staging apps to the live apps.
- `.github/workflows/rollback-live.yml` - Workflow for rolling back the latest live apps to their previous backup copies (in case the latest ones happen to be problematic).
