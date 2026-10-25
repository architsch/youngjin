import RestAPI from "../../../../client/networking/api/restAPI";
import SignInProvider from "./signInProvider";

const DiscordSignInProvider: SignInProvider =
{
    id: "discord",
    isConfigured: () => !!process.env.DISCORD_OAUTH_CLIENT_ID && !!process.env.DISCORD_OAUTH_CLIENT_SECRET,
    getAuthorizeURL: (state: string, redirectURL: string): string =>
    {
        return `https://discord.com/oauth2/authorize?${new URLSearchParams({
            client_id: process.env.DISCORD_OAUTH_CLIENT_ID ?? "", response_type: "code", redirect_uri: redirectURL,
            scope: "identify email", state, prompt: "consent"})}`;
    },
    fetchIdentity: async (code: string, redirectURL: string) =>
    {
        // Discord's token endpoint takes a form, not JSON.
        const tokenRes = await RestAPI.post("https://discord.com/api/oauth2/token", {form: {
            client_id: process.env.DISCORD_OAUTH_CLIENT_ID ?? "",
            client_secret: process.env.DISCORD_OAUTH_CLIENT_SECRET ?? "", grant_type: "authorization_code", code,
            redirect_uri: redirectURL}});
        const accessToken = tokenRes.data?.access_token;
        if (tokenRes.status < 200 || tokenRes.status >= 300 || typeof accessToken != "string")
            return {status: 500, error: "Failed to fetch the access token from Discord API."};

        const userRes = await RestAPI.get("https://discord.com/api/users/@me", {
            headers: {"Authorization": `Bearer ${accessToken}`},
        });
        if (userRes.status < 200 || userRes.status >= 300)
            return {status: 500, error: "Failed to fetch the user info from Discord API."};

        const user = userRes.data as {username?: string, email?: string | null, verified?: boolean};
        if (!user.email || user.verified !== true)
            return {status: 403, error: "This Discord account has no verified email address."};
        return {email: user.email, preferredName: user.username ?? user.email.split("@")[0]};
    },
};

export default DiscordSignInProvider;
