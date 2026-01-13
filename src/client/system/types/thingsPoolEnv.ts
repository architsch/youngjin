import User from "../../../shared/auth/types/user";

export default interface ThingsPoolEnv
{
    mode: string,
    user: User,
    socket_server_url: string,
    assets_url: string,
}