import App from "../../../app";
import Button from "../input/button";
import Form from "./form";
import Text from "../basic/text";
import UserAPIClient from "../../../networking/client/userAPIClient";
import SignInProviderNameMap from "../../../../shared/user/maps/signInProviderNameMap";
import Spacer from "../basic/spacer";

// The services a person may sign in through here (see SignInProviderMap): to keep a guest's name and looks as an
// account's, or to switch to another account.
export default function AuthPromptForm()
{
    const providerIDs = App.getEnv().sign_in_providers.filter(id => SignInProviderNameMap[id] != undefined);

    return <Form>
        <Spacer size="sm"/>
        {providerIDs.map(id => <Button key={id} id={`${id}SignInButton`} name={`Continue with ${SignInProviderNameMap[id]}`}
            size="md" onClick={() => UserAPIClient.signIn(id)}/>)}
        {providerIDs.length == 0 && <Text content="Signing in isn't available right now." size="md"/>}
    </Form>
}
