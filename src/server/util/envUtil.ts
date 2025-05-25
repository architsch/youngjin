import dotenv from "dotenv";
dotenv.config();

const envUtil =
{
    getRootURL: (): string =>
    {
        switch (process.env.MODE)
        {
            case "dev": return `http://localhost:${process.env.PORT}`;
            case "prod": return process.env.ROOT_URL as string;
            default: console.error(`Unknown mode :: ${process.env.MODE}`); return "_ERROR_"
        }
    },
    isDevMode: (): boolean => {
        return process.env.MODE == "dev";
    },
}

export default envUtil;