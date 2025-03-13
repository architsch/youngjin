require("dotenv").config();

const envUtil =
{
    getRootURL: () =>
    {
        switch (process.env.MODE)
        {
            case "dev": return `http://localhost:${process.env.PORT}`;
            case "prod": return process.env.ROOT_URL;
            default: console.error(`Unknown mode :: ${process.env.MODE}`);
        }
    },
    isDevMode: () => {
        return process.env.MODE == "dev";
    },
}

module.exports = envUtil;