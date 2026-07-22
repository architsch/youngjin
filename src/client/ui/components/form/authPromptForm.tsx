import Spacer from "../basic/spacer";
import Button from "../basic/button";
import Text from "../basic/text";
import Form from "../basic/form";
import PopupUtil from "../../util/popupUtil";
import UserAPIClient from "../../../networking/client/userAPIClient";

export default function AuthPromptForm()
{
    return <Form>
        <Text content="Login" size="lg"/>
        <Spacer size="sm"/>
        <Button name="Continue as Guest" size="md" onClick={PopupUtil.closePopup}/>
        <Button name="Login with Google" size="md" onClick={UserAPIClient.loginWithGoogle}/>
    </Form>
}