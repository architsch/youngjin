import Spacer from "../basic/spacer";
import Button from "../basic/button";
import Text from "../basic/text";
import Form from "../basic/form";

export default function AuthPromptForm({
    onPlayAsGuestButtonClick,
    onLoginWithGoogleButtonClick
}: Props)
{
    return <Form>
        <Text content="Sign In" size="lg"/>
        <Spacer size="sm"/>
        <Button name="Continue as Guest" size="md" onClick={onPlayAsGuestButtonClick}/>
        <Button name="Sign In with Google" size="md" onClick={onLoginWithGoogleButtonClick}/>
    </Form>
}

interface Props
{
    onPlayAsGuestButtonClick: () => void;
    onLoginWithGoogleButtonClick: () => void;
}