module.exports = {
    apps: [{
        name: "admin",
        script: "dev/scripts/bootstrap.js",
        env: {
            MODE: "prod",
            PORT: 3000,
            SKIP_SSG: "true",
            SKIP_CSS_COMPILE: "true",
            SKIP_CLIENT_COMPILE: "true",
            SKIP_SERVER_COMPILE: "true",
            NODE_ENV: "production",
            GOOGLE_APPLICATION_CREDENTIALS: "/root/service-account-key.json",
        },
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "512M",
        kill_timeout: 10000,
    }],
};
