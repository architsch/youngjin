// Secrets from Google Secret Manager, read with the application default credentials (`gcloud auth
// application-default login`) on a developer's machine. The VPS loads its own (see bootstrap.js).

const GCP_PROJECT_ID = "thingspool";

/**
 * Puts each named secret the environment lacks into it. One of `required` that can't be had throws; one of
 * `optional` is only reported.
 */
async function loadSecrets(tag, required, optional = [])
{
    const missing = [...required, ...optional].filter(name => !process.env[name]);
    if (missing.length == 0)
        return;

    console.log(`[${tag}] Loading ${missing.join(", ")} from Google Secret Manager...`);
    const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
    const client = new SecretManagerServiceClient();
    try
    {
        // Credentials first: a request made without them leaves a rejection in the client that crashes the process.
        await client.auth.getClient();
        for (const name of missing)
            await loadSecret(client, tag, name, optional.includes(name));
    }
    catch (err)
    {
        if (missing.some(name => !optional.includes(name)))
            throw err;
        console.log(`[${tag}] Optional ${missing.join(", ")} not loaded (${err.message}).`);
    }
    finally
    {
        // An open client keeps a script from exiting.
        await client.close().catch(() => {});
    }
}

async function loadSecret(client, tag, name, optional)
{
    let payload;
    try
    {
        const [version] = await client.accessSecretVersion({
            name: `projects/${GCP_PROJECT_ID}/secrets/${name}/versions/latest`,
        });
        payload = version.payload?.data;
    }
    catch (err)
    {
        if (!optional)
            throw err;
        console.log(`[${tag}] Optional secret "${name}" not loaded (${err.message}).`);
        return;
    }
    if (payload)
    {
        process.env[name] = (typeof payload == "string") ? payload : Buffer.from(payload).toString("utf8");
        console.log(`[${tag}] Secret "${name}" loaded.`);
    }
    else if (optional)
        console.log(`[${tag}] Optional secret "${name}" has no payload.`);
    else
        throw new Error(`Secret "${name}" has no payload.`);
}

module.exports = { loadSecrets };
