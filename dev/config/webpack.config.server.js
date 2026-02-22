const path = require("path");
const webpack = require("webpack");
const { execSync } = require("child_process");
const nodeExternals = require('webpack-node-externals');

let gitCommit = "";
try { gitCommit = execSync("git rev-parse --short HEAD").toString().trim(); } catch (_) {}

module.exports = {
    entry: path.resolve(__dirname, '../../src/server/server.ts'),
    target: 'node',
    mode: 'production',
    plugins: [
        new webpack.DefinePlugin({
            __GIT_COMMIT__: JSON.stringify(gitCommit),
        }),
    ],
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                loader: 'ts-loader',
                options: {
                    configFile: path.resolve(__dirname, '../../dev/config/tsconfig.server.json'),
                },
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: `bundle.js`,
        path: path.resolve(__dirname, '../../dist/server'),
    },
    externals: [nodeExternals()],
};