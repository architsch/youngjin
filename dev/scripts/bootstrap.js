/**
 * VPS production entry: loads secrets from Google Secret Manager into process.env, then requires the
 * server bundle (some modules read process.env at load time). Authenticates with the key file named by
 * GOOGLE_APPLICATION_CREDENTIALS.
 */

const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

const GCP_PROJECT_ID = "thingspool";

const SECRET_NAMES = [
    "JWT_SECRET_KEY",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
];

async function loadSecrets()
{
    const client = new SecretManagerServiceClient();

    for (const secretName of SECRET_NAMES)
    {
        if (process.env[secretName])
        {
            console.log(`[bootstrap] Secret "${secretName}" already in env, skipping.`);
            continue;
        }

        const [version] = await client.accessSecretVersion({
            name: `projects/${GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`,
        });

        const payload = version.payload?.data;
        if (payload)
        {
            process.env[secretName] = typeof payload === "string"
                ? payload
                : Buffer.from(payload).toString("utf8");
            console.log(`[bootstrap] Secret "${secretName}" loaded from Secret Manager.`);
        }
        else
        {
            console.error(`[bootstrap] Secret "${secretName}" has no payload in Secret Manager.`);
            process.exit(1);
        }
    }
}

async function main()
{
    console.log("[bootstrap] Loading secrets from Google Secret Manager...");
    await loadSecrets();
    const bundlePath = process.env.BUNDLE_PATH || "../../dist/server/bundle.js";
    console.log(`[bootstrap] All secrets loaded. Starting server from ${bundlePath}...`);
    require(bundlePath);
}

main().catch((err) => {
    console.error("[bootstrap] Fatal error:", err);
    process.exit(1);
});
