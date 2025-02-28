require("dotenv").config();

const envUtil =
{
    getRootURL: () =>
    {
        switch (process.env.MODE)
        {
            case "dev": return process.env.PWD + "/" + process.env.STATIC_PAGE_ROOT_DIR;
            case "prod": return process.env.ROOT_URL;
            default: console.error(`Unknown mode :: ${process.env.MODE}`);
        }
    },
    isDevMode: () => {
        return process.env.MODE == "dev";
    },
}

module.exports = envUtil;