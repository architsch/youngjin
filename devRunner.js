const path = require("path");
const nodeExternals = require('webpack-node-externals');
const webpack = require("webpack");

if (process.env.MODE == "dev")
{
    const webpackConfig = {
        entry: `./src/server/server.ts`,
        target: 'node',
        mode: 'development',
        devtool: 'inline-source-map',
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
        output: {
            filename: `bundle.js`,
            path: path.resolve(__dirname, 'dist/server'),
        },
        externals: [nodeExternals()],
    };

    const compiler = webpack(webpackConfig, (err, stats) => {
        if (err || stats.hasErrors())
        {
            throw new Error(stats.toString());
        }
        else
        {
            console.log(`Webpack compiler loaded`);
            compiler.run((callback) => {
                console.log(`Webpack compiler run complete`);
                require("./dist/server/bundle.js");
            });
        }
    });
}
else
{
    console.error("devRunner.js is not supposed to run on a non-dev mode.");
}