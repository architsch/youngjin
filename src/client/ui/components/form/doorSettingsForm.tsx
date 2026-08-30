import { useState } from "react";
import Checkbox from "../input/checkbox";
import Form from "./form";
import DoorSettingsProps from "../../types/doorSettingsProps";

// What a door is, as against where it leads. There is one question here so far, and it is about the
// room rather than about the door: which of its doors a player arriving with nowhere particular in
// mind is put down behind (see SpawnHotspotUtil).
export default function DoorSettingsForm({ isDefaultEntrance, onSetDefaultEntrance }: DoorSettingsProps)
{
    const [checked, setChecked] = useState<boolean>(isDefaultEntrance);

    return <Form>
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
