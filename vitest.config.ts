import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        root: ".",
        include: ["tests/**/*.test.ts"],
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
