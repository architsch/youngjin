module.exports = {
    apps: [{
        name: "admin",
        script: "dev/scripts/bootstrap.js",
        env: {
            MODE: "prod",
            PORT: 3000,
            NODE_ENV: "production",
            GOOGLE_APPLICATION_CREDENTIALS: "/root/service-account-key.json",
        },
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "512M",
    }],
};
