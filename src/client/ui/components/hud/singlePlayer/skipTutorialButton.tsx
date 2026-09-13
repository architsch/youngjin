import { useEffect, useState } from "react";
import { singlePlayerObservable } from "../../../../system/clientObservables";
import SinglePlayerManager from "../../../../singlePlayer/singlePlayerManager";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../../../shared/system/sharedConstants";
import PopupUtil from "../../../util/popupUtil";
import Button from "../../input/button";

// Skip button, shown during the tutorial unless other bottom UI would overlap (parent's `hide`).
// Confirms first, then sends the player to a hub. Tutorial-specific by design (its wording says so).
const skippable = (mode: string) => mode == TUTORIAL_SINGLE_PLAYER_MODE;

export default function SkipTutorialButton({ hide }: Props)
{
    const [active, setActive] = useState(skippable(singlePlayerObservable.peek().mode));

    useEffect(() => {
        const onChange = (v: {mode: string, step: string}) => setActive(skippable(v.mode));
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
