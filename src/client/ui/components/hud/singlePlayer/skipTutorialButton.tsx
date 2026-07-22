import { useEffect, useState } from "react";
import { singlePlayerObservable } from "../../../../system/clientObservables";
import SinglePlayerManager from "../../../../singlePlayer/singlePlayerManager";
import PopupUtil from "../../../util/popupUtil";
import Button from "../../input/button";

// A button that lets the user bail out of the single-player tutorial. It lives at the bottom
// of the screen and is shown only while a single-player mode is active and no other bottom UI
// (Chat / VoxelQuadSelection / ObjectSelection) would overlap it — the parent decides the
// latter via the `hide` prop. Clicking it asks for confirmation first (to guard against an
// accidental tap); confirming skips the tutorial and sends the player to the hub.
export default function SkipTutorialButton({ hide }: Props)
{
    const [active, setActive] = useState(singlePlayerObservable.peek().mode != "");

    useEffect(() => {
        const onChange = (v: {mode: string, step: string}) => setActive(v.mode != "");
        singlePlayerObservable.addListener("ui.skipTutorial", onChange);
        // Sync to the current value in case the mode was set before this component mounted.
        onChange(singlePlayerObservable.peek());
        return () => singlePlayerObservable.removeListener("ui.skipTutorial");
    }, []);

    if (!active || hide) return null;

    return <Button
        name="Skip Tutorial"
        size="sm"
        onClick={() => PopupUtil.openPopup({
            popupType: "confirm",
            params: {
                message: "Skip the tutorial?",
                onConfirm: () => {
                    PopupUtil.closePopup();
                    SinglePlayerManager.skipSinglePlayerMode();
                },
                onCancel: PopupUtil.closePopup,
            },
        })}
        additionalClassNames="self-end m-2 pointer-events-auto"
    />;
}

interface Props
{
    hide: boolean;
}
