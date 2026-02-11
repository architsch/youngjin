const webpackConfig_server = require("../config/webpack.config.server.js");
const webpackConfig_client = require("../config/webpack.config.client.js");
const webpack = require("webpack");
const { exec } = require("child_process");

const GCP_PROJECT_ID = "thingspool";
const SECRET_NAMES = [
    "JWT_SECRET_KEY",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
];

async function loadSecrets()
{
    const allPresent = SECRET_NAMES.every(name => process.env[name]);
    if (allPresent)
    {
        console.log("[devRunner] Secrets already in environment, skipping fetch.");
        return;
    }

    console.log("[devRunner] Loading secrets from Google Secret Manager...");
    const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
    const client = new SecretManagerServiceClient();

    for (const name of SECRET_NAMES)
    {
        if (process.env[name]) continue;

        const [version] = await client.accessSecretVersion({
            name: `projects/${GCP_PROJECT_ID}/secrets/${name}/versions/latest`,
        });
        const payload = version.payload?.data;
        if (payload)
        {
            process.env[name] = typeof payload === "string"
                ? payload
                : Buffer.from(payload).toString("utf8");
            console.log(`[devRunner] Secret "${name}" loaded.`);
        }
        else
        {
            console.error(`[devRunner] Secret "${name}" has no payload.`);
        }
    }
}

async function main()
{
    await loadSecrets();

    console.log(`========================================
Env Variables in DevRunner:
========================================
    MODE: ${process.env.MODE}
    SKIP_SSG: ${process.env.SKIP_SSG}
    PORT: ${process.env.PORT}
    SKIP_CSS_COMPILE: ${process.env.SKIP_CSS_COMPILE}
    SKIP_CLIENT_COMPILE: ${process.env.SKIP_CLIENT_COMPILE}
    SKIP_SERVER_COMPILE: ${process.env.SKIP_SERVER_COMPILE}
========================================`);

    if (process.env.MODE == "dev")
    {
        try {
            // Compile CSS
            if (process.env.SKIP_CSS_COMPILE != "true")
            {
                exec(`npm run compileCSS`, (error, stdout, stderr) => {
                    if (error)
                    {
                        console.error(`(compileCSS) Error executing npm script: ${error.message}`);
                        return;
                    }
                    console.log(`CSS Compiled (stdout: ${stdout}, stderr: ${stderr})`);
                });
            }

            // Compile the server app
            if (process.env.SKIP_SERVER_COMPILE != "true")
            {
                compile(webpackConfig_server, (callback) => {
                    console.log("Server Compiled");
                    require("../../dist/server/bundle.js"); // Start the server immediately when the bundle is ready.
                });
            }
            else
            {
                require("../../dist/server/bundle.js");
            }

            // Compile the client app
            if (process.env.SKIP_CLIENT_COMPILE != "true")
            {
                compile(webpackConfig_client, (callback) => {
                    console.log("Client Compiled");
                });
            }
        } catch (err) {
            console.error("########## DevRunner Exception ##########\n" + (err instanceof Error) ? err.message : String(err));
        } finally {
            // Prevent automatic restart
            console.log("DevRunner :: Sleep Started");
            setInterval(() => {}, 36000000);
        }
    }
    else
    {
        console.error("devRunner.js is not supposed to run on a non-dev mode.");
        // Prevent automatic restart
        console.log("DevRunner :: Sleep Started");
        setInterval(() => {}, 36000000);
    }
}

main().catch((err) => {
    console.error("[devRunner] Fatal error:", err);
    process.exit(1);
});

function compile(webpackConfig, onAfterCompile)
{
    const devModeWebpackConfig = {};
    Object.assign(devModeWebpackConfig, webpackConfig);
    devModeWebpackConfig.mode = "development";
    devModeWebpackConfig.devtool = "inline-source-map";

    const compiler = webpack(devModeWebpackConfig, (err, stats) => {
        if (err || stats.hasErrors())
        {
            console.error("########## Webpack Compilation Error ##########\n" + stats.toString());
            // Prevent automatic restart when compilation fails
            setInterval(() => {}, 36000000);
        }
        else
            compiler.run(onAfterCompile);
    });
}
