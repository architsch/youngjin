import Spacer from "../basic/spacer";
import Button from "../input/button";
import Text from "../basic/text";
import Form from "./form";
import PopupUtil from "../../util/popupUtil";

// What a user with an account of their own is asked on their way out. Leaving and switching
// accounts arrive here as the same wish — the user is done being this person on this page — so both
// are answered in one place, and picking either one is itself the confirmation.
export default function ExitPromptForm({ onExit }: Props)
{
    return <Form>
        <Text content="Are you done for now?" size="lg"/>
        <Spacer size="sm"/>
        <Button name="Login with another account" size="md" onClick={() => {
            // The login prompt takes this one's place rather than standing on top of it: the choice
            // this prompt offered has been made, so closing the login prompt belongs to whatever
            // was on screen before either of them.
            PopupUtil.closePopup();
            PopupUtil.openPopup({popupType: "authPrompt"});
        }}/>
        <Button name="Exit this App" size="md" color="red" onClick={() => {
            // Taken down first, so that a browser which refuses to let the page go leaves the user
            // back in the app rather than behind a prompt that has already been answered.
            PopupUtil.closePopup();
            onExit();
        }}/>
    </Form>
}

interface Props
{
    onExit: () => void;
}
