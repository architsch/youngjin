import axios, { AxiosError, AxiosResponse } from "axios";
import App from "../app";

const AuthClient =
{
    register: async (userName: string, password: string): Promise<AxiosResponse | AxiosError> =>
    {
        try {
            return await axios.post(getURL("register"), {userName, password});
        } catch (err) {
            if (axios.isAxiosError(err))
                return err as AxiosError;
            else
                throw new Error((err instanceof Error) ? err.message : String(err));
        }
    },
    login: async (userName: string, password: string): Promise<AxiosResponse | AxiosError> =>
    {
        try {
            return await axios.post(getURL("login"), {userName, password});
        } catch (err) {
            if (axios.isAxiosError(err))
                return err as AxiosError;
            else
                throw new Error((err instanceof Error) ? err.message : String(err));
        }
    },
    logout: async (): Promise<AxiosResponse | AxiosError> =>
    {
        try {
            return await axios.get(getURL("logout"));
        } catch (err) {
            if (axios.isAxiosError(err))
                return err as AxiosError;
            else
                throw new Error((err instanceof Error) ? err.message : String(err));
        }
    },
}

function getURL(type: string): string
{
    return `${App.getEnv().socket_server_url}/api/auth/${type}`;
}

export default AuthClient;