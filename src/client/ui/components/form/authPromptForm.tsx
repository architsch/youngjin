import Button from "../input/button";
import Form from "./form";
import UserAPIClient from "../../../networking/client/userAPIClient";
import Spacer from "../basic/spacer";

export default function AuthPromptForm()
{
    return <Form>
        <Spacer size="sm"/>
        <Button name="Login with Google" size="md" onClick={UserAPIClient.loginWithGoogle}/>
    </Form>
}