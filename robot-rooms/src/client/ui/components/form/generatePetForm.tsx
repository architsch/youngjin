import { ReactNode, useState } from "react";
import Button from "../input/button";
import FormTextInput from "../input/formTextInput";
import LevelSliderInput from "../input/levelSliderInput";
import PaletteColorInput from "../input/paletteColorInput";
import StepperInput from "../input/stepperInput";
import PriceTag from "../basic/priceTag";
import Spacer from "../basic/spacer";
import Text from "../basic/text";
import Form from "./form";
import GeneratePetProps from "../../types/generatePetProps";
import PetGenerationUtil, { PET_FIXED_ENERGY_LABELS, PET_FIXED_HEALTH_LABELS,
    PET_TRAIT_NAMES } from "../../util/petGenerationUtil";
import PopupUtil from "../../util/popupUtil";
import PetIdentityUtil, { PET_COLOR_PALETTE_NAME, PET_NAME_MAX_LENGTH,
    PET_TRAIT_LEVEL_LABELS } from "../../../../shared/object/util/petIdentityUtil";
import { PET_PRICE_DOLLARS } from "../../../../shared/system/sharedConstants";

const MEDIUM_LEVEL = 1;

// What a pet is generated with (see PetGenerationUtil): its name, its color (white, unless they pick another), how
// much of each trait it has, and, for an admin, whose pets stay with the room, the health and the charge it is kept at
// (full, unless they pick less).
export default function GeneratePetForm({ selection }: GeneratePetProps)
{
    const [name, setName] = useState<string>("");
    const [colorIndex, setColorIndex] = useState<number>(0);
    const [traitLevels, setTraitLevels] = useState<number[]>(PET_TRAIT_NAMES.map(() => MEDIUM_LEVEL));
    const [fixedHealthIndex, setFixedHealthIndex] = useState<number>(PET_FIXED_HEALTH_LABELS.length - 1);
    const [fixedEnergyIndex, setFixedEnergyIndex] = useState<number>(PET_FIXED_ENERGY_LABELS.length - 1);

    const named = PetIdentityUtil.sanitizeName(name).length > 0;
    const canGenerate = named && PetGenerationUtil.canGenerate(selection);
    // A setting beside its label, in the column the traits' labels line up in.
    const row = (label: string, control: ReactNode) =>
        <div className="flex flex-row items-center gap-2 w-full">
            <Text content={label} size="sm" additionalClassNames="w-32 shrink-0"/>
            {control}
        </div>;
    const fixedStepper = (id: string, label: string, labels: string[], index: number, setIndex: (index: number) => void) =>
        row(label, <StepperInput id={id} currValue={index} numValues={labels.length} setValue={setIndex} labels={labels}/>);

    return <Form id="generatePetForm">
        <FormTextInput label="Name" size="sm" placeholder={`Up to ${PET_NAME_MAX_LENGTH} characters`} currValue={name}
            filterTextInput={PetGenerationUtil.filterName} setTextInput={setName}/>
        <Spacer size="sm"/>
        {row("Color", <PaletteColorInput paletteName={PET_COLOR_PALETTE_NAME} currValue={colorIndex}
            setColorIndex={setColorIndex}/>)}
        {PET_TRAIT_NAMES.map((traitName, i) => <LevelSliderInput key={traitName} id={`petTrait.${i}`} label={traitName}
            levelLabels={PET_TRAIT_LEVEL_LABELS} currLevel={traitLevels[i]}
            setLevel={level => setTraitLevels(levels => levels.map((old, j) => (j == i) ? level : old))}/>)}
        {PetGenerationUtil.picksFixedNeeds() && <>
            {fixedStepper("petFixedHealthStepper", "Fixed health", PET_FIXED_HEALTH_LABELS, fixedHealthIndex,
                setFixedHealthIndex)}
            {fixedStepper("petFixedEnergyStepper", "Fixed energy", PET_FIXED_ENERGY_LABELS, fixedEnergyIndex,
                setFixedEnergyIndex)}
        </>}
        <Spacer size="sm"/>
        <Button id="generatePetButton" name="Generate" size="md" color="green" disabled={!canGenerate}
            onClick={() => void PetGenerationUtil.generate(selection, name, traitLevels, fixedHealthIndex, fixedEnergyIndex,
                colorIndex)}>
            <PriceTag dollars={PET_PRICE_DOLLARS} inButton={true}/>
        </Button>
        <Button id="cancelPetButton" name="Cancel" size="md" onClick={PopupUtil.closePopup}/>
    </Form>;
}
