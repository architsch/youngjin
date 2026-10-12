import Spacer from "../basic/spacer";
import ConfirmButtons from "../input/confirmButtons";
import Text from "../basic/text";
import Form from "./form";
import ConfirmProps from "../../types/confirmProps";

export default function ConfirmForm({
    message, onConfirm, onCancel,
}: ConfirmProps)
{
    return <Form>
        <Text content={message} size="lg"/>
        <Spacer size="sm"/>
        <ConfirmButtons onConfirm={onConfirm} onCancel={onCancel}/>
    </Form>
}
