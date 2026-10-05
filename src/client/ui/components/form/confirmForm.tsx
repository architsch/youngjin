import { useRef } from "react";
import Spacer from "../basic/spacer";
import Button from "../input/button";
import Text from "../basic/text";
import Form from "./form";
import ConfirmProps from "../../types/confirmProps";
import { CONFIRM_ARMING_DELAY_MS } from "../../../system/clientConstants";

export default function ConfirmForm({
    message, onConfirm, onCancel,
}: ConfirmProps)
{
    // A Yes that comes the moment the form does is a click or key press meant for what was there before, so none is
    // taken until the form has been up for a while. Yes is drawn no differently meanwhile, on purpose.
    const openedAt = useRef(Date.now());
    const confirm = () => {
        if (Date.now() - openedAt.current >= CONFIRM_ARMING_DELAY_MS)
            onConfirm();
    };

    return <Form>
        <Text content={message} size="lg"/>
        <Spacer size="sm"/>
        <Button name="Yes" size="md" color="green" shortcutKey="Enter" onClick={confirm}/>
        <Button name="No" size="md" onClick={onCancel}/>
    </Form>
}