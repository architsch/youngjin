const path = require("path");
const webpack = require("webpack");
const { execSync } = require("child_process");
const nodeExternals = require('webpack-node-externals');

let gitCommit = "";
try { gitCommit = execSync("git rev-parse --short HEAD").toString().trim(); } catch (_) {}

// Defense-in-depth: when building for an environment where `sharp` will not be
// installed at runtime (e.g. the VPS, where SSG never runs), set EXCLUDE_SHARP=true
// to make webpack ignore any `require("sharp")`/`import "sharp"` it encounters.
// This catches accidental future static imports of sharp from runtime code paths.
// Leave EXCLUDE_SHARP unset for local builds so SSG can still load sharp.
const plugins = [
    new webpack.DefinePlugin({
        __GIT_COMMIT__: JSON.stringify(gitCommit),
    }),
];
if (process.env.EXCLUDE_SHARP === "true") {
    plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^sharp$/ }));
}

module.exports = {
    entry: path.resolve(__dirname, '../../src/server/server.ts'),
    target: 'node',
    mode: 'production',
    plugins,
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
        // Wipe dist/server before each build to avoid stale async chunks accumulating,
        // but preserve bundle.live.js / bundle.backup.js — those belong to the live
        // server's promote/rollback flow ([promote-live.yml] and [rollback-live.yml])
        // and are independent of the staging build cycle.
        clean: { keep: /\.(live|backup)\./ },
    },
    externals: [nodeExternals()],
};