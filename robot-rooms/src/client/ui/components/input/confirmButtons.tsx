import { useRef } from "react";
import Button from "./button";
import { CONFIRM_ARMING_DELAY_MS } from "../../../system/clientConstants";

// The two answers a popup asking for the user's say-so ends in, one under the other.
export default function ConfirmButtons({ onConfirm, onCancel }: Props)
{
    // A Yes that comes the moment the buttons do is a click or key press meant for what was there before, so none is
    // taken until they have been up for a while. Yes is drawn no differently meanwhile, on purpose.
    const shownAt = useRef(Date.now());
    const confirm = () => {
        if (Date.now() - shownAt.current >= CONFIRM_ARMING_DELAY_MS)
            onConfirm();
    };

    return <>
        <Button name="Yes" size="md" color="green" shortcutKey="Enter" onClick={confirm}/>
        <Button name="No" size="md" onClick={onCancel}/>
    </>
}

interface Props
{
    onConfirm: () => void;
    onCancel: () => void;
}
