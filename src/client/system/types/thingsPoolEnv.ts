export default interface ThingsPoolEnv
{
    mode: string,
    serverType: string,
    userString: string,
    socket_server_url: string,
    rest_api_server_url: string,
    static_server_url: string,
    assets_url: string,
    gitCommit: string,
    targetRoomID: string,
    // On an agent's camera page, its link's token and the agent's user, whose eyes the page sees through (see
    // AgentCameraUtil); both empty on any other page.
    cameraToken: string,
    watchedUserID: string,
    // The ids of the services a person may sign in through here (see SignInProviderNameMap).
    sign_in_providers: string[],
}