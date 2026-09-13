import Spacer from "../basic/spacer";
import Button from "../input/button";
import Text from "../basic/text";
import Form from "./form";
import PopupUtil from "../../util/popupUtil";

// Exit prompt for account holders: leave, or switch accounts. Choosing is the confirmation.
export default function ExitPromptForm({ onExit }: Props)
{
    return <Form>
        <Text content="Are you done for now?" size="lg"/>
        <Spacer size="sm"/>
        <Button name="Login with another account" size="md" onClick={() => {
            // Replace this popup with the login prompt rather than stacking.
            PopupUtil.closePopup();
            PopupUtil.openPopup({popupType: "authPrompt"});
        }}/>
        <Button name="Exit this App" size="md" color="red" onClick={() => {
            // Close first, in case the browser refuses to navigate away.
            PopupUtil.closePopup();
            onExit();
        }}/>
    </Form>
}

interface Props
{
    onExit: () => void;
}
