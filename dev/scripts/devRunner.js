const webpackConfig_server = require("../config/webpack.config.server.js");
const webpackConfig_client = require("../config/webpack.config.client.js");
const webpack = require("webpack");
const { exec } = require("child_process");

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