const os = require("os");
import { URL_DYNAMIC, URL_STATIC } from "../../system/serverConstants";

const dev = process.env.MODE == "dev";

const AddressUtil =
{
    getErrorPageURL: (errorPageName: string) => {
        return `${AddressUtil.getEnvStaticURL()}/error/${errorPageName}.html`;
    },
    getMyPageURL: () => {
        return `${AddressUtil.getEnvDynamicURL()}/mypage`;
    },
    getEnvStaticURL: () => {
        return dev ? getLocalURL() : URL_STATIC;
    },
    getEnvDynamicURL: () => {
        return dev ? getLocalURL() : URL_DYNAMIC;
    },
}

function getLocalURL(): string
{
    return `http://${getLocalDomain()}:${process.env.PORT}`;
}

function getLocalDomain(): string
{
    if (!dev)
        throw new Error("Calling 'getLocalDomain' is not allowed in a non-dev mode.");

    return "127.0.0.1";

    /*const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces))
    {
        for (const i of interfaces[name])
        {
            if (i.family == "IPv4" && !i.internal)
                return i.address;
        }
    }
    return "127.0.0.1";*/
}

export default AddressUtil;