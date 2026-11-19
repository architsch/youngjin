const path = require("path");

// The browser-side renderer SSG's composition thumbnails are drawn with (see CompositionThumbnailBuilder).
// Built on demand into temp/, never shipped; type checking is left to the client build.
module.exports = {
    entry: path.resolve(__dirname, '../../src/client/graphics/thumbnail/compositionThumbnailRenderer.ts'),
    target: 'web',
    mode: 'development',
    devtool: false,
    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                loader: 'ts-loader',
                options: {
                    configFile: path.resolve(__dirname, '../../dev/config/tsconfig.client.json'),
                    transpileOnly: true,
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
        path: path.resolve(__dirname, '../../temp/composition_thumbnail'),
    },
};
