import Spacer from "../basic/spacer";
import Button from "../input/button";
import Text from "../basic/text";
import Form from "./form";
import PopupUtil from "../../util/popupUtil";

export default function MyRoomWelcomeForm()
{
    return <Form>
        <Text content="This is your room!" size="lg"/>
        <Text content="Build whatever you like in here." size="sm"/>
        <Spacer size="sm"/>
        <Button name="OK" size="md" color="green" onClick={PopupUtil.closePopup}/>
    </Form>
}
