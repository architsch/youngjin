const webpackConfig_server = require("./build/webpack.config.server");
const webpackConfig_client = require("./build/webpack.config.client");
const webpack = require("webpack");

if (process.env.MODE == "dev")
{
    compile(webpackConfig_server, (callback) => {
        console.log("Server Compiled");
        require("./dist/server/bundle.js"); // Start the server immediately when the bundle is ready.
    });
    compile(webpackConfig_client, (callback) => {
        console.log("Client Compiled");
    });
}
else
{
    console.error("devRunner.js is not supposed to run on a non-dev mode.");
}

function compile(webpackConfig, onAfterCompile)
{
    const devModeWebpackConfig = {};
    Object.assign(devModeWebpackConfig, webpackConfig);
    devModeWebpackConfig.mode = "development";
    devModeWebpackConfig.devtool = "inline-source-map";
    
    const compiler = webpack(devModeWebpackConfig, (err, stats) => {
        if (err || stats.hasErrors())
            throw new Error(stats.toString());
        else
            compiler.run(onAfterCompile);
    });
}