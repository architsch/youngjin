import Button from "../basic/button";
import { Z_INDEX_HUD_MAIN } from "../../../../shared/system/sharedConstants";
import User from "../../../../shared/user/types/user";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";

export default function UserIdentity({
    env,
    user,
    onAuthPromptButtonClick,
}: Props)
{
    const dev = env.mode == "dev";

    return <div className={className}>
        <div className="p-1">{user.userName + (dev ? "(dev)" : "")}</div>
        <div className="flex flex-row p-1 gap-1">
            <Button name="Sign In" size="sm" onClick={onAuthPromptButtonClick}/>
        </div>
    </div>;
}

const className = `flex flex-col absolute right-0 top-0 py-1 px-2 text-amber-200 text-right bg-black/50 ${Z_INDEX_HUD_MAIN}`;

interface Props
{
    env: ThingsPoolEnv;
    user: User;
    onAuthPromptButtonClick: () => void;
}