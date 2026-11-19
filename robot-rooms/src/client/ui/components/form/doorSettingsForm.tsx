import { useState } from "react";
import Checkbox from "../input/checkbox";
import Form from "./form";
import DoorSettingsProps from "../../types/doorSettingsProps";

// Door settings: whether it is a default entrance for arrivals with no specific door (see
// SpawnHotspotUtil).
export default function DoorSettingsForm({ isDefaultEntrance, onSetDefaultEntrance }: DoorSettingsProps)
{
    const [checked, setChecked] = useState<boolean>(isDefaultEntrance);

    return <Form id="doorSettingsForm">
        <Checkbox
            label="Use this door as a default entrance"
            size="sm"
            checked={checked}
            onChange={(nextChecked: boolean) => {
                setChecked(nextChecked);
                onSetDefaultEntrance(nextChecked);
            }}
        />
    </Form>;
}
