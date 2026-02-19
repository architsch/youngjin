const sharedEnv = {
    MODE: "prod",
    SKIP_SSG: "true",
    SKIP_CSS_COMPILE: "true",
    SKIP_CLIENT_COMPILE: "true",
    SKIP_SERVER_COMPILE: "true",
    NODE_ENV: "production",
    GOOGLE_APPLICATION_CREDENTIALS: "/root/service-account-key.json",
};

module.exports = {
    apps: [
        {
            name: "live",
            script: "dev/scripts/bootstrap.js",
            env: {
                ...sharedEnv,
                PORT: 3000,
                BUNDLE_PATH: "../../dist/server/bundle.live.js",
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "256M",
            kill_timeout: 10000,
        },
        {
            name: "staging",
            script: "dev/scripts/bootstrap.js",
            env: {
                ...sharedEnv,
                PORT: 3001,
                BUNDLE_PATH: "../../dist/server/bundle.js",
                DB_PREFIX: "staging_",
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "256M",
            kill_timeout: 10000,
        },
    ],
};
