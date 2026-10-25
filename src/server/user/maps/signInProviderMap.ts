import SignInProvider from "../types/signInProvider/signInProvider";
import GoogleSignInProvider from "../types/signInProvider/googleSignInProvider";
import GitHubSignInProvider from "../types/signInProvider/gitHubSignInProvider";
import DiscordSignInProvider from "../types/signInProvider/discordSignInProvider";

// In the order they are offered (see SignInProviderNameMap, which names them for the browser).
const PROVIDERS: SignInProvider[] = [GoogleSignInProvider, GitHubSignInProvider, DiscordSignInProvider];

const SignInProviderMap =
{
    getAll: (): SignInProvider[] =>
    {
        return PROVIDERS;
    },
    // The ids of those a person may choose here: each whose OAuth client is set up, or every one in dev, where none is
    // contacted (see DevOAuthUtil).
    getOfferedIDs: (): string[] =>
    {
        return PROVIDERS.filter(provider => process.env.MODE == "dev" || provider.isConfigured())
            .map(provider => provider.id);
    },
}

export default SignInProviderMap;
