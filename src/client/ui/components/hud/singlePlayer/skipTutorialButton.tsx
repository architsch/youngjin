import { useEffect, useState } from "react";
import { singlePlayerObservable } from "../../../../system/clientObservables";
import SinglePlayerManager from "../../../../singlePlayer/singlePlayerManager";
import { TUTORIAL_SINGLE_PLAYER_MODE } from "../../../../../shared/system/sharedConstants";
import PopupUtil from "../../../util/popupUtil";
import Button from "../../input/button";

// A button that lets the user bail out of the single-player tutorial. It lives at the bottom
// of the screen and is shown only while the tutorial is being played and no other bottom UI
// (Chat / VoxelQuadSelection / ObjectSelection) would overlap it — the parent decides the
// latter via the `hide` prop. Clicking it asks for confirmation first (to guard against an
// accidental tap); confirming skips the tutorial and sends the player to the hub.
//
// Named for the one mode it belongs to, rather than offered to single-player modes at large. What
// it offers is a way out of being walked through something, which is a thing only the tutorial does
// — and the button says so in as many words, so a mode that inherited it would be offering to skip a
// tutorial the user is not in. Any future mode wanting its own way out wants its own wording too.
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
