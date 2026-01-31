import Spacer from "../basic/spacer";
import Button from "../basic/button";
import Text from "../basic/text";
import UserAPIClient from "../../../networking/client/userAPIClient";
import Form from "../basic/form";

export default function SignOutForm({
    onCancel,
}: Props)
{
    return <Form>
        <Text content="Want to sign out?" size="lg"/>
        <Spacer size="sm"/>
        <Button name="Yes" size="md" color="green" onClick={() => logout(onCancel)}/>
        <Button name="No" size="md" onClick={onCancel}/>
    </Form>
}

async function logout(onCancel: () => void): Promise<void>
{
    const response = await UserAPIClient.logout();
    if (response.status >= 200 && response.status < 300)
    {
        window.location.reload();
    }
    else
    {
        onCancel();
        alert("Failed to sign out. Please try again.");
    }
}

interface Props
{
    onCancel: () => void;
}