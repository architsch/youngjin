import { useEffect, useState } from "react";
import { InstancedMeshCompositionParams } from "../../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import { PLAYER_SHAPE_PRICE_DOLLARS } from "../../../../shared/system/sharedConstants";
import { pendingPurchaseElementObservable } from "../../../system/clientObservables";
import DollarSignIcon from "../../svg/icons/dollarSignIcon";
import LockIcon from "../../svg/icons/lockIcon";
import PartShapeIcon from "../../svg/icons/partShapeIcon";
import SpinnerIcon from "../../svg/icons/spinnerIcon";
import RefusalCoachMarkUtil from "../../util/refusalCoachMarkUtil";
import UnlockBurstUtil from "../../util/unlockBurstUtil";
import ToggledGridInput from "./toggledGridInput";

const COLUMNS = 3;

// One of a character's part's shapes, chosen from a grid of their pictures. A locked one is dimmed, marked with its price,
// and clicking it unlocks it rather than choosing it, darkened under a spinner until the server answers; once that goes
// through it is chosen, with the grid left open, its picture pops and sparks burst over it, once.
export default function PartShapeInput({ id, builderName, numShapes, params, currValue, setValue, isLocked, unlock }: Props)
{
    // Those whose pictures are popping, as they do once on being unlocked: never again on the grid's opening again.
    const [poppingShapes, setPoppingShapes] = useState<number[]>([]);
    const [pendingElementId, setPendingElementId] = useState(pendingPurchaseElementObservable.peek());

    useEffect(() => {
        const listenerKey = `ui.partShapeInput.${id}`;
        pendingPurchaseElementObservable.addListener(listenerKey, setPendingElementId);
        return () => pendingPurchaseElementObservable.removeListener(listenerKey);
    }, [id]);

    const renderShape = (shape: number, close: () => void) => {
        const locked = isLocked(shape);
        const popping = poppingShapes.includes(shape);
        const elementId = `${id}.${shape}`;
        return <button
            key={"shape-" + shape}
            id={elementId}
            className={`relative size-16 p-1.5 shrink-0 rounded-md bg-gray-800 cursor-pointer select-none touch-manipulation border-2 ${(shape == currValue) ? "border-white shadow-[inset_0_0_0_2px_#000000]" : "border-gray-600"}`}
            onClick={() => {
                if (!locked)
                {
                    setValue(shape);
                    close();
                    return;
                }
                unlock(shape, elementId, () => {
                    setValue(shape);
                    // Only over the tile it is, in the grid still open (an answer coming late may find it closed).
                    const tile = document.getElementById(elementId);
                    if (tile == null)
                        return;
                    setPoppingShapes(prev => [...prev, shape]);
                    UnlockBurstUtil.burstOver(tile);
                });
            }}
        >
            <div className={`size-full ${locked ? "opacity-35" : ""} ${popping ? "animate-unlock-pop" : ""}`}
                onAnimationEnd={() => setPoppingShapes(prev => prev.filter(other => other != shape))}>
                <PartShapeIcon params={params} builderType={`${builderName}_${shape}`}/>
            </div>
            {locked && <>
                <div className="absolute top-0.5 left-0.5 size-4 text-white"><LockIcon/></div>
                <div className="absolute bottom-0.5 right-0.5 flex flex-row items-center gap-0.5">
                    <div className="size-3.5 shrink-0"><DollarSignIcon/></div>
                    {/* Not the UI's monospace, whose zero is slashed. */}
                    <span className="font-sans text-xs font-bold leading-none text-green-300">{PLAYER_SHAPE_PRICE_DOLLARS}</span>
                </div>
            </>}
            {elementId == pendingElementId && <div className="absolute inset-0 flex items-center justify-center rounded bg-black/65">
                <div className="size-7 text-white"><SpinnerIcon/></div>
            </div>}
        </button>;
    };

    return <ToggledGridInput
        id={id}
        numCells={numShapes}
        columnsOnHorizontalScreen={COLUMNS}
        columnsOnVerticalScreen={COLUMNS}
        renderCell={renderShape}
        buttonClassNames="flex items-center justify-center w-full h-10 shrink-0 rounded-md cursor-pointer select-none touch-manipulation bg-gray-700 yj-surface-concave"
        buttonContent={<div className="size-8"><PartShapeIcon params={params} builderType={`${builderName}_${currValue}`}/></div>}
        onClose={() => {
            RefusalCoachMarkUtil.hide();
            setPoppingShapes([]);
        }}
    />;
}

interface Props
{
    // The button's, for automation, and each shape's is this followed by its number (e.g. "partShape_head.3").
    id: string;
    // With a shape's number, names the composition builder its picture is drawn from.
    builderName: string;
    numShapes: number;
    params: InstancedMeshCompositionParams;
    currValue: number;
    setValue: (value: number) => void;
    isLocked: (shape: number) => boolean;
    // elementId: the shape's tile. onUnlocked runs once the shape is the user's.
    unlock: (shape: number, elementId: string, onUnlocked: () => void) => void;
}
