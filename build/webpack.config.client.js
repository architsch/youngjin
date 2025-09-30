const path = require("path");

module.exports = {
    entry: path.resolve(__dirname, '../src/client/client.ts'),
    target: 'web',
    mode: 'development',
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                loader: 'ts-loader',
                options: {
                    configFile: path.resolve(__dirname, '../build/tsconfig.client.json'),
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
        path: path.resolve(__dirname, '../public/app'),
    },
};