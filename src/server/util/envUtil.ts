import dotenv from "dotenv";
dotenv.config();

const EnvUtil =
{
    getRootURL: (): string =>
    {
        switch (process.env.MODE)
        {
            case "dev": return `http://localhost:${process.env.PORT}`;
            case "ssg": return process.env.ROOT_URL as string;
            case "prod": return process.env.ROOT_URL as string;
            default: console.error(`Unknown mode :: ${process.env.MODE}`); return "_ERROR_"
        }
    },
    isDevMode: (): boolean => {
        return process.env.MODE == "dev";
    },
    isSSGMode: (): boolean => {
        return process.env.MODE == "ssg";
    },
    isProdMode: (): boolean => {
        return process.env.MODE == "prod";
    },
}

export default EnvUtil;