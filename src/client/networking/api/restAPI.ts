import ErrorUtil from "../../../shared/system/util/errorUtil";

const RestAPI =
{
    get: async (url: string, requestConfig?: RestAPIRequestConfig): Promise<RestAPIResponse> =>
    {
        return await send("GET", url, requestConfig);
    },
    post: async (url: string, requestConfig?: RestAPIRequestConfig): Promise<RestAPIResponse> =>
    {
        return await send("POST", url, requestConfig);
    },
    put: async (url: string, requestConfig?: RestAPIRequestConfig): Promise<RestAPIResponse> =>
    {
        return await send("PUT", url, requestConfig);
    },
    delete: async (url: string, requestConfig?: RestAPIRequestConfig): Promise<RestAPIResponse> =>
    {
        return await send("DELETE", url, requestConfig);
    },
}

async function send(method: "GET" | "POST" | "PUT" | "DELETE",
    url: string, requestConfig?: RestAPIRequestConfig): Promise<RestAPIResponse>
{
    try {
        const headers: Record<string, string> = {...requestConfig?.headers};
        let body: string | undefined = undefined;

        // Only a request that carries data declares a JSON body. Google's OAuth token endpoint is
        // POSTed with its parameters in the query string, and rejects one that claims to have a body.
        if (requestConfig?.data != undefined)
        {
            body = JSON.stringify(requestConfig.data);
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(url, {method, headers, body, credentials: "same-origin"});
        return {status: response.status, data: await readBody(response)};
    } catch (err) {
        // fetch rejects only when the request never completed (no response to report a status from).
        return {status: 500, data: ErrorUtil.getErrorMessage(err)};
    }
}

// A JSON payload reaches the caller parsed; anything else (an error page, a bare status line) reaches
// it as text.
async function readBody(response: Response): Promise<any>
{
    const text = await response.text();
    if (text.length == 0)
        return "";
    if ((response.headers.get("content-type") ?? "").includes("json"))
    {
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }
    return text;
}

export interface RestAPIRequestConfig
{
    data?: any;
    headers?: Record<string, string>;
}

export interface RestAPIResponse
{
    status: number;
    data: any;
}

export default RestAPI;
