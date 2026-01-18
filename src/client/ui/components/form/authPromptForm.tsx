import Spacer from "../basic/spacer";
import Button from "../basic/button";
import Text from "../basic/text";

export default function AuthPromptForm({
    onPlayAsGuestButtonClick,
    onLoginWithGoogleButtonClick
}: Props)
{
    return <div className="flex flex-col gap-2">
        <Text content="Welcome, Guest!" size="lg"/>
        <Spacer size="sm"/>
        <Button name="Play as Guest" size="md" onClick={onPlayAsGuestButtonClick}/>
        <Button name="Sign In with Google" size="md" onClick={onLoginWithGoogleButtonClick}/>
    </div>
}

interface Props
{
    onPlayAsGuestButtonClick: () => void;
    onLoginWithGoogleButtonClick: () => void;
}