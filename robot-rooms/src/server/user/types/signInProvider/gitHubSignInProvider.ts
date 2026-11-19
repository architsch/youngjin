import RestAPI from "../../../../client/networking/api/restAPI";
import SignInProvider from "./signInProvider";

// GitHub's API refuses a request that names no User-Agent.
const API_HEADERS = {"Accept": "application/vnd.github+json", "User-Agent": "ThingsPool"};

// A GitHub App or an OAuth App: both sign people in this way (an App's permissions stand in for the scopes, and it
// needs "Email addresses" read access).
const GitHubSignInProvider: SignInProvider =
{
    id: "github",
    isConfigured: () => !!process.env.GITHUB_OAUTH_CLIENT_ID && !!process.env.GITHUB_OAUTH_CLIENT_SECRET,
    getAuthorizeURL: (state: string, redirectURL: string): string =>
    {
        return `https://github.com/login/oauth/authorize?${new URLSearchParams({
            client_id: process.env.GITHUB_OAUTH_CLIENT_ID ?? "", redirect_uri: redirectURL,
            scope: "read:user user:email", state})}`;
    },
    fetchIdentity: async (code: string, redirectURL: string) =>
    {
        // A refused code still answers 200, with an error in place of the token.
        const tokenRes = await RestAPI.post("https://github.com/login/oauth/access_token", {
            data: {client_id: process.env.GITHUB_OAUTH_CLIENT_ID ?? "",
                client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET ?? "", code, redirect_uri: redirectURL},
            headers: {"Accept": "application/json"},
        });
        const accessToken = tokenRes.data?.access_token;
        if (tokenRes.status < 200 || tokenRes.status >= 300 || typeof accessToken != "string")
            return {status: 500, error: "Failed to fetch the access token from GitHub API."};

        const headers = {...API_HEADERS, "Authorization": `Bearer ${accessToken}`};
        const [userRes, emailsRes] = await Promise.all([
            RestAPI.get("https://api.github.com/user", {headers}),
            RestAPI.get("https://api.github.com/user/emails", {headers}),
        ]);
        if (userRes.status < 200 || userRes.status >= 300 || emailsRes.status < 200 || emailsRes.status >= 300
            || !Array.isArray(emailsRes.data))
        {
            return {status: 500, error: "Failed to fetch the user info from GitHub API."};
        }

        const emails = emailsRes.data as {email: string, primary: boolean, verified: boolean}[];
        const email = emails.find(entry => entry.primary && entry.verified)?.email;
        if (!email)
            return {status: 403, error: "This GitHub account has no verified primary email address."};
        return {email, preferredName: (userRes.data as {login?: string}).login ?? email.split("@")[0]};
    },
};

export default GitHubSignInProvider;
