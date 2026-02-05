const os = require("os");
import { URL_DYNAMIC, URL_STATIC } from "../../system/serverConstants";

const dev = process.env.MODE == "dev";

// If this is set to TRUE, the local IP address will simply be "localhost" (This is for testing features which require the server URL to be based on "localhost" instead of an actual IP address).
const forceLocalhost = true;

const AddressUtil =
{
    getErrorPageURL: (errorPageName: string) => {
        return `${AddressUtil.getEnvStaticURL()}/error/${errorPageName}.html`;
    },
    getMyPageURL: () => {
        return dev ? `${AddressUtil.getEnvDynamicURL()}/mypage` : AddressUtil.getEnvDynamicURL();
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
    if (forceLocalhost)
        return "localhost";

    if (!dev)
        throw new Error("Calling 'getLocalDomain' is not allowed in a non-dev mode.");

    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces))
    {
        for (const i of interfaces[name])
        {
            if (i.family == "IPv4" && !i.internal)
                return i.address;
        }
    }
    return "127.0.0.1";
}

export default AddressUtil;