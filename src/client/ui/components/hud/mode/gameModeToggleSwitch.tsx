import { useEffect, useState } from "react";
import GameMode from "../../../../system/types/gameMode";
import GameModeUtil from "../../../../system/util/gameModeUtil";
import ClientObjectManager from "../../../../object/clientObjectManager";
import { clientFeatureFlagsObservable, gameModeObservable } from "../../../../system/clientObservables";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";

//------------------------------------------------------------------------
// The way into edit mode, and the plainest way back out of it (see GameModeUtil): a switch with the
// two modes written on either side of it, standing on whichever one the user is in.
//
// A switch rather than a button, because the two modes are one choice between two states, and a
// switch is what says so: its setting is in plain sight at all times, and flipping it one way is
// undone by flipping it back. A button naming its own effect says what pressing it would do, and
// leaves the user to work out what he is in now.
//
// Nothing is drawn behind it. It sits over the 3D scene, so the switch and both labels carry a dark
// outline of their own instead, to stay legible over whatever the room behind them happens to be.
//
// While a scripted step holds the user in his mode it is greyed out rather than taken away: which
// mode he is in is still worth being told, and a control that vanished would be one he had to find
// again the moment the step gave it back.
//------------------------------------------------------------------------

export default function GameModeToggleSwitch()
{
    const [gameMode, setGameMode] = useState<GameMode>(GameModeUtil.getGameMode());
    const [canChangeGameMode, setCanChangeGameMode] = useState<boolean>(GameModeUtil.canChangeGameMode());

    useEffect(() => {
        gameModeObservable.addListener("ui.gameModeToggleSwitch",
            (mode: GameMode) => setGameMode(mode));
        clientFeatureFlagsObservable.addElementListener("ui.gameModeToggleSwitch",
            FeatureFlag.DisableGameModeTransition, (action) => setCanChangeGameMode(action != "add"));
        return () => {
            gameModeObservable.removeListener("ui.gameModeToggleSwitch");
            clientFeatureFlagsObservable.removeElementListener("ui.gameModeToggleSwitch",
                FeatureFlag.DisableGameModeTransition);
        };
    }, []);

    const onClick = () => {
        if (gameMode == "edit") // Is in edit mode
        {
            GameModeUtil.exitEditMode();
            return;
        }
        else // Is in play mode
        {
            // The mode opens on the user's own character, so there is no mode to open without one.
            const myPlayer = ClientObjectManager.getMyPlayer();
            if (myPlayer)
                GameModeUtil.enterEditMode(myPlayer);
        }
    };

    // A div rather than a button, like every other control here, which is why what it is and what it
    // is set to are stated for whatever reads the page rather than looks at it.
    return <div
        id="gameModeToggleSwitch"
        role="switch"
        aria-disabled={!canChangeGameMode}
        className={`flex flex-row items-center mr-3 gap-2 shrink-0 select-none touch-manipulation pointer-events-auto ${canChangeGameMode ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
        onClick={canChangeGameMode ? onClick : undefined}
    >
        <span className={labelClassNames(gameMode, "play")}>Play</span>
        {/* The track holds the setting, so it is sunk into the screen; the knob is the thing that
            moves, so it stands out of it (see the depth rules in input.css). It has an id of its own
            so that the tutorial can outline the capsule alone, apart from the labels. */}
        <div id="gameModeToggleSwitchTrack" className={`relative w-11 h-6 shrink-0 rounded-full border-2 border-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-colors duration-200 ${(gameMode == "edit") ? "bg-green-300" : "bg-pink-300"}`}>
            <div className={`absolute top-0.5 left-0.5 size-4 rounded-full border border-black bg-linear-to-b from-white to-gray-400 shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-transform duration-200 ease-out ${(gameMode == "edit") ? "translate-x-5" : "translate-x-0"}`}/>
        </div>
        <span className={labelClassNames(gameMode, "edit")}>Edit</span>
    </div>;
}

// Every colour class is spelled out in full, because Tailwind only generates the classes it finds
// written in the source; one assembled at runtime from a prefix and a colour name matches no rule.
function labelClassNames(currentGameMode: GameMode, myGameMode: GameMode): string
{
    const color = (currentGameMode != myGameMode)
        ? "text-gray-400"
        : (myGameMode == "play" ? "text-pink-300" : "text-green-300");
    return `text-sm font-semibold yj-text-outline transition-colors duration-200 ${color}`;
}