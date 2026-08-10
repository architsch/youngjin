import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        root: ".",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/integration/setup.ts"],
        env: {
            // The DB tests run against the Firestore emulator, so they need collections of their
            // own: without a prefix they would share — and clear — the collections a local
            // `npm run dev` session keeps its data in. Every other suite mocks the DB layer
            // outright and never reads these names.
            DB_PREFIX: "dbtest_",
            FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080",
            GCLOUD_PROJECT: process.env.GCLOUD_PROJECT ?? "thingspool",
        },
        testTimeout: 30_000,
        hookTimeout: 15_000,
        sequence: {
            concurrent: false, // Run tests sequentially — server state is shared
        },
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
});
