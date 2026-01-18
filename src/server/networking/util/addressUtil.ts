const os = require("os");
import dotenv from "dotenv";
dotenv.config();

// If this is set to TRUE, the local IP address will simply be "localhost" (This is for testing features which require the server URL to be based on "localhost" instead of an actual IP address).
const forceLocalhost = true;

const AddressUtil =
{
    getErrorPageURL: (errorPageName: string) => {
        return `${process.env.MODE == "dev" ? `http://${AddressUtil.getLocalIpAddress()}:${process.env.PORT}` : process.env.URL_STATIC}/error/${errorPageName}.html`;
    },
    getMyPageURL: () => {
        return `${process.env.MODE == "dev" ? `http://${AddressUtil.getLocalIpAddress()}:${process.env.PORT}` : process.env.URL_DYNAMIC}/mypage`;
    },
    getLocalIpAddress: () =>
    {
        if (forceLocalhost)
            return "localhost";

        if (process.env.MODE != "dev")
            throw new Error("Calling 'getLocalIpAddress' is not allowed in a non-dev mode.");

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
    },
}

export default AddressUtil;