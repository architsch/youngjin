import Spacer from "../basic/spacer";
import Button from "../basic/button";
import Text from "../basic/text";
import Form from "../basic/form";
import ConfirmProps from "../../types/confirmProps";

export default function ConfirmForm({
    message, onConfirm, onCancel,
}: ConfirmProps)
{
    return <Form>
        <Text content={message} size="lg"/>
        <Spacer size="sm"/>
        <Button name="Yes" size="md" color="green" onClick={onConfirm}/>
        <Button name="No" size="md" onClick={onCancel}/>
    </Form>
}