import Button from "../basic/button";
import User from "../../../../shared/user/types/user";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";

export default function UserIdentity({
    env,
    user,
    onAuthPromptButtonClick,
    onSignOutButtonClick,
}: Props)
{
    const isGuest = user.userName.startsWith("Guest-");

    return <div className={className}>
        <div className="flex flex-row">
            <div className="yj-text-sm text-gray-400">Your Name:</div>
            <div className="yj-text-sm text-amber-300">{user.userName}</div>
        </div>
        {isGuest && <Button name="Sign In" size="sm" onClick={onAuthPromptButtonClick}/>}
        {!isGuest && <Button name="Sign Out" size="sm" onClick={onSignOutButtonClick}/>}
    </div>;
}

const className = "flex flex-col justify-end gap-1 absolute right-0 top-0 py-1 px-2 text-right bg-black";

interface Props
{
    env: ThingsPoolEnv;
    user: User;
    onAuthPromptButtonClick: () => void;
    onSignOutButtonClick: () => void;
}