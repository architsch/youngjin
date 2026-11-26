const webpackConfig_server = require("../config/webpack.config.server.js");
const webpackConfig_client = require("../config/webpack.config.client.js");
const webpack = require("webpack");
const { exec } = require("child_process");
const { loadSecrets } = require("./lib/secrets");

const SECRET_NAMES = [
    "JWT_SECRET_KEY",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
];
// Loaded as on the VPS (see bootstrap.js), so that helpers and pets answer through the model here too.
// SKIP_AI_REPLIES=true leaves it out, for a run that shouldn't spend: helpers then only greet.
const AI_SECRET_NAMES = ["ANTHROPIC_API_KEY"];

async function main()
{
    const skipAIReplies = process.env.SKIP_AI_REPLIES == "true";
    if (skipAIReplies)
        AI_SECRET_NAMES.forEach(name => delete process.env[name]);
    await loadSecrets("devRunner", SECRET_NAMES, skipAIReplies ? [] : AI_SECRET_NAMES);

    console.log(`========================================
Env Variables in DevRunner:
========================================
    MODE: ${process.env.MODE}
    SKIP_SSG: ${process.env.SKIP_SSG}
    PORT: ${process.env.PORT}
    SKIP_CSS_COMPILE: ${process.env.SKIP_CSS_COMPILE}
    SKIP_CLIENT_COMPILE: ${process.env.SKIP_CLIENT_COMPILE}
    SKIP_SERVER_COMPILE: ${process.env.SKIP_SERVER_COMPILE}
    SKIP_AI_REPLIES: ${process.env.SKIP_AI_REPLIES}
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
    devModeWebpackConfig.devtool = "source-map";

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
