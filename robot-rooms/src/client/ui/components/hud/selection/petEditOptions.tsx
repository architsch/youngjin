import { useEffect, useReducer } from "react";
import App from "../../../../app";
import IconButton from "../../input/iconButton";
import Button from "../../input/button";
import TrashIcon from "../../../svg/icons/trashIcon";
import PriceTag from "../../basic/priceTag";
import SelectionToolRow from "./selectionToolRow";
import ObjectEditUtil from "../../../util/objectEditUtil";
import PetInjectUtil from "../../../util/petInjectUtil";
import PetSellUtil from "../../../util/petSellUtil";
import EditOptionsProps from "../../../types/editOptionsProps";
import { dollarsInFlightObservable, inventoryObservable, petInjectedObservable } from "../../../../system/clientObservables";
import { PetInjection, PetInjectionEnumMap } from "../../../../../shared/object/types/petInjection";
import PetInjectionUtil from "../../../../../shared/object/util/petInjectionUtil";

// How often the tools are read off the pet again, in milliseconds: what it sells for falls with its health, and what it
// can take changes with what it shows of itself, which re-announces no selection (see ClientObjectManager).
const REFRESH_MS = 500;
const LISTENER_KEY = "ui.petEditOptions";
const UNDER_BUTTON_CLASS_NAMES = "absolute top-full left-1/2 -translate-x-1/2 mt-1";

// A pet's tools, in edit mode and in play mode alike (see PlayModeSelectionUtil). Anyone puts a battery into it unless
// its charge is kept where it is, and a wrench unless its health is (see PetInjectionUtil), each for the price under
// its button. Its owner also removes it, which sells it, for what is shown under that button.
export default function PetEditOptions(props: EditOptionsProps)
{
    const [, refresh] = useReducer((x: number) => x + 1, 0);
    useEffect(() => {
        const interval = setInterval(refresh, REFRESH_MS);
        inventoryObservable.addListener(LISTENER_KEY, refresh);
        dollarsInFlightObservable.addListener(LISTENER_KEY, refresh);
        petInjectedObservable.addListener(LISTENER_KEY, refresh);
        return () => {
            clearInterval(interval);
            inventoryObservable.removeListener(LISTENER_KEY);
            dollarsInFlightObservable.removeListener(LISTENER_KEY);
            petInjectedObservable.removeListener(LISTENER_KEY);
        };
    }, []);

    const pet = props.selection.gameObject.params;
    const injectButton = (id: string, name: string, tooltip: string, injection: PetInjection) =>
        <div className="relative shrink-0">
            <Button id={id} name={name} size="md" tooltip={tooltip} disabled={!PetInjectUtil.canInject(pet, injection)}
                onClick={() => PetInjectUtil.inject(pet, injection)}/>
            <PriceTag dollars={PetInjectionUtil.getPrice(injection)} additionalClassNames={UNDER_BUTTON_CLASS_NAMES}/>
        </div>;

    // The row is deeper beneath its buttons, for what is shown under each.
    return <SelectionToolRow additionalClassNames="pb-6">
        {pet.sourceUserID == App.getUser().id && <div className="relative shrink-0">
            <IconButton id="removePetButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => PetSellUtil.openConfirmPopup(props.selection)}
            />
            <PriceTag dollars={PetSellUtil.getPrice(pet)} gain={true} additionalClassNames={UNDER_BUTTON_CLASS_NAMES}/>
        </div>}
        {PetInjectionUtil.takesBattery(pet) && injectButton("injectBatteryButton", "Charge",
            "This will recharge your pet's battery.", PetInjectionEnumMap.Battery)}
        {PetInjectionUtil.takesWrench(pet) && injectButton("injectWrenchButton", "Repair",
            "This will clean up your pet's rust and extend its lifespan.", PetInjectionEnumMap.Wrench)}
    </SelectionToolRow>;
}
