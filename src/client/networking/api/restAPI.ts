import axios, { AxiosRequestConfig } from "axios";
import ErrorUtil from "../../../shared/system/util/errorUtil";

const RestAPI =
{
    get: async (url: string, requestConfig?: AxiosRequestConfig): Promise<RestAPIResponse> =>
    {
        return await send("get", url, requestConfig);
    },
    post: async (url: string, requestConfig?: AxiosRequestConfig): Promise<RestAPIResponse> =>
    {
        return await send("post", url, requestConfig);
    },
    put: async (url: string, requestConfig?: AxiosRequestConfig): Promise<RestAPIResponse> =>
    {
        return await send("put", url, requestConfig);
    },
    delete: async (url: string, requestConfig?: AxiosRequestConfig): Promise<RestAPIResponse> =>
    {
        return await send("delete", url, requestConfig);
    },
}

async function send(method: "get" | "post" | "put" | "delete",
    url: string, requestConfig?: AxiosRequestConfig): Promise<RestAPIResponse>
{
    try {
        const axiosResponse = await axios[method](url, requestConfig);
        return { status: axiosResponse.status, data: axiosResponse.data };
    } catch (err) {
        if (axios.isAxiosError(err))
        {
            if (err.response)
                return { status: err.response.status, data: err.response.data };
            else
                return { status: err.status ?? 500, data: err.message };
        }
        else
        {
            return { status: 500, data: ErrorUtil.getErrorMessage(err) };
        }
    }
}

export interface RestAPIResponse
{
    status: number;
    data: any;
}

export default RestAPI;