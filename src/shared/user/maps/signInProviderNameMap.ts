// The services a person signs in through, by the id their routes and buttons go by, in the order they are offered (see
// SignInProviderMap).
const SignInProviderNameMap: {[providerID: string]: string} =
{
    google: "Google",
    github: "GitHub",
    discord: "Discord",
};

export default SignInProviderNameMap;
