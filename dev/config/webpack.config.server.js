const path = require("path");
const nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: path.resolve(__dirname, '../../src/server/server.ts'),
    target: 'node',
    mode: 'production',
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