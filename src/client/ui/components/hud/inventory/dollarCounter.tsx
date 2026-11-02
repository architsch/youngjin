import { useEffect, useState } from "react";
import { InventoryItemTypeEnumMap } from "../../../../../shared/inventory/types/inventoryItemType";
import ClientInventoryManager from "../../../../inventory/clientInventoryManager";
import { dollarsInFlightObservable, dollarsSpentObservable, inventoryGainObservable, inventoryObservable,
    loginRewardStageObservable } from "../../../../system/clientObservables";
import DollarSignIcon from "../../../svg/icons/dollarSignIcon";

// How many dollars the user holds, in the screen's corner, which bounces and glows as a bill reaches it, a login's reward is
// shown or dollars are spent, growing out of that corner. Sits over the room without taking a click from it, and over a
// coach mark below it, which would otherwise hide most of a bounce.
export default function DollarCounter()
{
    const [dollars, setDollars] = useState<number>(ClientInventoryManager.getDollarsShown());
    // Remounts what bounces, which plays the animation from its start.
    const [bounce, setBounce] = useState<{numBounces: number, kind: keyof typeof ANIMATIONS}>({numBounces: 0, kind: "gain"});

    useEffect(() => {
        const show = () => setDollars(ClientInventoryManager.getDollarsShown());
        const playBounce = (kind: keyof typeof ANIMATIONS) => setBounce(prev => ({numBounces: prev.numBounces + 1, kind}));
        inventoryObservable.addListener("ui.dollarCounter", show);
        dollarsInFlightObservable.addListener("ui.dollarCounter", show);
        inventoryGainObservable.addListener("ui.dollarCounter", itemType => {
            if (itemType == InventoryItemTypeEnumMap.Dollar)
                playBounce("gain");
        });
        dollarsSpentObservable.addListener("ui.dollarCounter", () => playBounce("spend"));
        loginRewardStageObservable.addListener("ui.dollarCounter", stage => {
            if (stage == "shown")
                playBounce("reward");
        });
        return () => {
            inventoryObservable.removeListener("ui.dollarCounter");
            dollarsInFlightObservable.removeListener("ui.dollarCounter");
            inventoryGainObservable.removeListener("ui.dollarCounter");
            dollarsSpentObservable.removeListener("ui.dollarCounter");
            loginRewardStageObservable.removeListener("ui.dollarCounter");
        };
    }, []);

    const bounces = bounce.numBounces > 0;
    const counterAnimation = bounces ? ANIMATIONS[bounce.kind].counter : "";
    const numberAnimation = bounces ? ANIMATIONS[bounce.kind].number : "";

    return <div id="dollarCounter" className="relative z-31 mr-auto pointer-events-none select-none">
        <div key={bounce.numBounces} className={`flex flex-row items-center gap-1.5 origin-top-left ${counterAnimation}`}>
            <div className="size-6 shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"><DollarSignIcon/></div>
            {/* Not the UI's monospace, whose zero is slashed. */}
            <span className={`font-sans text-xl font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${numberAnimation}`}>{dollars}</span>
        </div>
    </div>;
}

const ANIMATIONS = {
    gain: {counter: "animate-dollar-gain", number: "animate-dollar-gain-number"},
    reward: {counter: "animate-dollar-reward", number: "animate-dollar-reward-number"},
    spend: {counter: "animate-dollar-spend", number: "animate-dollar-spend-number"},
};
