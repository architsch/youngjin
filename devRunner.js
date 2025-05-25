const path = require("path");
const nodeExternals = require('webpack-node-externals');
const webpack = require("webpack");

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
        filename: `server.bundle.js`,
        path: path.resolve(__dirname, 'dist'),
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

            process.env.TYPE = "website";
            require("./dist/server.bundle.js");
        });
    }
});