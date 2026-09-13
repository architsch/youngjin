import { useEffect, useState } from "react";
import GameMode from "../../../../system/types/gameMode";
import GameModeUtil from "../../../../system/util/gameModeUtil";
import ClientObjectManager from "../../../../object/clientObjectManager";
import CameraUtil from "../../../../graphics/util/cameraUtil";
import { clientFeatureFlagsObservable, gameModeObservable } from "../../../../system/clientObservables";
import { FeatureFlag } from "../../../../../shared/system/types/featureFlag";

// Play/edit switch (see GameModeUtil). Outlined to read over the scene. Greyed out, not hidden, while
// a step locks the mode.

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
            // The mode falls back on the user's own character (see GameModeUtil), so there is no mode
            // to open without one.
            const myPlayer = ClientObjectManager.getMyPlayer();
            if (myPlayer)
                GameModeUtil.enterEditMode(myPlayer, CameraUtil.getObjectsAlongLineOfSight());
        }
    };

    // A div, so its role and state are declared for assistive tech.
    return <div
        id="gameModeToggleSwitch"
        role="switch"
        aria-checked={gameMode == "edit"}
        aria-disabled={!canChangeGameMode}
        className={`flex flex-row items-center mr-3 gap-2 shrink-0 select-none touch-manipulation pointer-events-auto ${canChangeGameMode ? "cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
        onClick={canChangeGameMode ? onClick : undefined}
    >
        <span className={labelClassNames(gameMode, "play")}>Play</span>
        {/* Sunken track, raised knob (see depth rules in input.css). Own id so the tutorial can outline it. */}
        <div id="gameModeToggleSwitchTrack" className={`relative w-11 h-6 shrink-0 rounded-full border-2 border-black shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-colors duration-200 ${(gameMode == "edit") ? "bg-green-300" : "bg-pink-300"}`}>
            <div className={`absolute top-0.5 left-0.5 size-4 rounded-full border border-black bg-linear-to-b from-white to-gray-400 shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-transform duration-200 ease-out ${(gameMode == "edit") ? "translate-x-5" : "translate-x-0"}`}/>
        </div>
        <span className={labelClassNames(gameMode, "edit")}>Edit</span>
    </div>;
}

// Full class names, since Tailwind can't see runtime-assembled ones.
function labelClassNames(currentGameMode: GameMode, myGameMode: GameMode): string
{
    const color = (currentGameMode != myGameMode)
        ? "text-gray-400"
        : (myGameMode == "play" ? "text-pink-300" : "text-green-300");
    return `text-sm font-semibold yj-text-outline transition-colors duration-200 ${color}`;
}