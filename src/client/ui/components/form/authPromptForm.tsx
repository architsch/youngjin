import Spacer from "../basic/spacer";
import Button from "../basic/button";
import Text from "../basic/text";
import Form from "../basic/form";
import PopupUtil from "../../util/popupUtil";
import UserAPIClient from "../../../networking/client/userAPIClient";

export default function AuthPromptForm()
{
    return <Form>
        <Text content="Sign In" size="lg"/>
        <Spacer size="sm"/>
        <Button name="Continue as Guest" size="md" onClick={PopupUtil.closePopup}/>
        <Button name="Sign In with Google" size="md" onClick={UserAPIClient.loginWithGoogle}/>
    </Form>
}