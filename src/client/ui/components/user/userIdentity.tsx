import Button from "../basic/button";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";
import { Z_INDEX_HUD_MAIN } from "../../../../shared/system/constants";

export default function UserIdentity({ env, onLogInButtonClick, onRegisterButtonClick }: UserIdentityProps)
{
    return <div className={className}>
        <div className="p-1">{env.user.userName}</div>
        <div className="flex flex-row p-1 gap-1">
            <Button name="Log In" size="sm" onClick={onLogInButtonClick}/>
            <Button name="Sign Up" size="sm" onClick={onRegisterButtonClick}/>
        </div>
    </div>;
}

const className = `flex flex-col absolute right-0 top-0 py-1 px-2 text-amber-200 text-right bg-black/50 ${Z_INDEX_HUD_MAIN}`;

interface UserIdentityProps
{
    env: ThingsPoolEnv;
    onRegisterButtonClick: () => void;
    onLogInButtonClick: () => void;
}