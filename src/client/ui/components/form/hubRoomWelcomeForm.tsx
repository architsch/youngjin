import Spacer from "../basic/spacer";
import Button from "../input/button";
import Text from "../basic/text";
import Form from "./form";
import PopupUtil from "../../util/popupUtil";

export default function HubRoomWelcomeForm()
{
    return <Form>
        <Text content="Welcome to the Hub" size="lg"/>
        <Text content="This is the open space, where you can socialize with others and build anything you want!" size="sm"/>
        <Spacer size="sm"/>
        <Button name="OK" size="md" color="green" onClick={PopupUtil.closePopup}/>
    </Form>
}
