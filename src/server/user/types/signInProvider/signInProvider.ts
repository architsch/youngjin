// A service a person signs in through (see UserSignInUtil): where to send them, and who they turned out to be.
// Accounts are found by email, so a provider gives one only once it has verified it: an email anyone could claim
// would open its owner's account to them.
export default interface SignInProvider
{
    id: string;
    // Whether its OAuth client is set up on this server.
    isConfigured: () => boolean;
    getAuthorizeURL: (state: string, redirectURL: string) => string;
    // The code exchanged for the person's verified email and the name to give a new account.
    fetchIdentity: (code: string, redirectURL: string) =>
        Promise<{email: string, preferredName: string} | {status: number, error: string}>;
}
