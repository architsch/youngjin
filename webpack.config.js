const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
    entry: `./src/server/server.ts`,
    target: 'node',
    mode: 'production',
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