const path = require("path");

module.exports = {
    entry: path.resolve(__dirname, '../../src/client/client.ts'),
    target: 'web',
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                loader: 'ts-loader',
                options: {
                    configFile: path.resolve(__dirname, '../../dev/config/tsconfig.client.json'),
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
        path: path.resolve(__dirname, '../../public/app'),
    },
};