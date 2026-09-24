const path = require("path");

module.exports = {
    // Named so the entry chunk emits as `bundle.js`, beside the `vendor.*.js` chunks below.
    entry: {
        bundle: path.resolve(__dirname, '../../src/client/client.ts'),
    },
    // The ES level webpack may emit for its own runtime and for minification. Must not exceed the
    // `target` in tsconfig.client.json, which is what the app's own code is downlevelled to.
    target: ['web', 'es2020'],
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
            // Inlined as a data URL, so a font costs no request of its own (see LabelText).
            {
                test: /\.ttf$/,
                type: 'asset/inline',
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    optimization: {
        // The dependencies are two thirds of what a player downloads and change only when one is
        // upgraded, so they are split off from the app's own code. All four chunks are served with
        // `no-cache` (revalidate, see [nginx_default.txt]); webpack rewrites a chunk only when its
        // contents differ, so a deploy that touched app code alone leaves these three byte-identical
        // and the browser gets a 304 for each instead of re-downloading them.
        //
        // They are initial chunks, not lazily loaded ones: the game needs all of them to draw its
        // first frame, so the page loads them in parallel (see the script tags in [mypage.ejs]).
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                three: {
                    test: /[\\/]node_modules[\\/]three[\\/]/,
                    name: 'vendor.three',
                    enforce: true,
                },
                react: {
                    test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                    name: 'vendor.react',
                    enforce: true,
                },
                misc: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendor.misc',
                    enforce: true,
                },
                // Bundled fonts change as rarely as the dependencies, so they ride in the same chunk.
                fonts: {
                    test: /\.ttf$/,
                    name: 'vendor.misc',
                    enforce: true,
                },
            },
        },
    },
    output: {
        filename: '[name].js',
        chunkFilename: '[name].js',
        path: path.resolve(__dirname, '../../dist/client'),
        // Drop chunks left behind by an earlier build, so a renamed one cannot linger and be served.
        // The stylesheet is compiled by a separate step that runs before this one, and the live and
        // backup copies belong to the promote/rollback flow ([promote-live.yml], [rollback-live.yml]).
        clean: {
            keep: (asset) => asset.endsWith('.css')
                || asset.includes('.live.') || asset.includes('.backup.'),
        },
    },
};
