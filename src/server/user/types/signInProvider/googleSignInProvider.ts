import RestAPI from "../../../../client/networking/api/restAPI";
import SignInProvider from "./signInProvider";

const GoogleSignInProvider: SignInProvider =
{
    id: "google",
    isConfigured: () => !!process.env.GOOGLE_OAUTH_CLIENT_ID && !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    // Forces the account chooser, so users can pick a different account.
    getAuthorizeURL: (state: string, redirectURL: string): string =>
    {
        return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
            client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "", response_type: "code", redirect_uri: redirectURL,
            scope: "openid profile email", access_type: "offline", state, prompt: "select_account consent"})}`;
    },
    fetchIdentity: async (code: string, redirectURL: string) =>
    {
        // Google's token endpoint takes its parameters in the query string (see RestAPI).
        const tokenRes = await RestAPI.post(`https://oauth2.googleapis.com/token?${new URLSearchParams({
            code, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
            client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "", redirect_uri: redirectURL,
            grant_type: "authorization_code"})}`);
        if (tokenRes.status < 200 || tokenRes.status >= 300)
            return {status: 500, error: "Failed to fetch the access token from Google API."};

        const userInfoRes = await RestAPI.get("https://www.googleapis.com/oauth2/v3/userinfo?alt=json", {
            headers: {authorization: `Bearer ${tokenRes.data.access_token as string}`},
        });
        if (userInfoRes.status < 200 || userInfoRes.status >= 300)
            return {status: 500, error: "Failed to fetch the user info from Google API."};

        const userInfo = userInfoRes.data as {email?: string, email_verified?: boolean};
        if (!userInfo.email)
            return {status: 404, error: "Email address not found."};
        if (userInfo.email_verified === false)
            return {status: 403, error: "This Google account's email address isn't verified."};
        return {email: userInfo.email, preferredName: userInfo.email.split("@")[0]};
    },
};

export default GoogleSignInProvider;
