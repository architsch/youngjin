import { ReactNode } from "react";
import Vec3 from "../../../../../src/shared/math/types/vec3";
import ParticleLayerConfig from "../../../../../src/client/graphics/particle/types/particleLayerConfig";
import LayerFieldSpecMap from "../maps/layerFieldSpecMap";
import ChoiceControl from "./choiceControl";
import ColorCurveControl from "./colorCurveControl";
import CurveControl from "./curveControl";
import FieldRow from "./fieldRow";
import HalfSizeControl from "./halfSizeControl";
import NumberControl from "./numberControl";
import RangeControl from "./rangeControl";
import SpriteControl from "./spriteControl";
import ToggleControl from "./toggleControl";

// One field of a layer, with the control its spec names. A value of the wrong shape (typed into the JSON) is
// shown as the default, and the effect's problems name it; editing the field replaces it.
export default function LayerField({ layer, field, onEdit }: Props)
{
    const spec = LayerFieldSpecMap.getSpec(field);
    const value: unknown = layer[field];
    const isSet = value !== undefined;
    const set = (next: unknown) => onEdit(current => ({...current, [field]: next}), field);
    const reset = () => onEdit(current =>
    {
        const next = {...current};
        delete next[field];
        return next;
    }, field);

    let control: ReactNode;
    let isRequired = false;
    switch (spec.kind)
    {
        case "sprite":
            isRequired = true;
            control = <SpriteControl value={String(value ?? "")} onChange={set} />;
            break;
        case "choice":
            control = <ChoiceControl options={spec.options} value={(typeof value == "string") ? value : spec.defaultValue}
                onChange={set} />;
            break;
        case "toggle":
            control = <ToggleControl value={(typeof value == "boolean") ? value : spec.defaultValue} onChange={set} />;
            break;
        case "number":
            control = <NumberControl value={isNumber(value) ? value : spec.defaultValue} min={spec.min} max={spec.max}
                step={spec.step} unit={spec.unit} onChange={set} />;
            break;
        case "range":
            isRequired = spec.defaultValue == undefined;
            control = <RangeControl value={isRange(value) ? value : (spec.defaultValue ?? [spec.min, spec.min])}
                min={spec.min} max={spec.max} step={spec.step} unit={spec.unit} onChange={set} />;
            break;
        case "halfSize":
            control = <HalfSizeControl value={isVec3(value) ? value : {x: 0, y: 0, z: 0}} max={spec.max}
                step={spec.step} onChange={set} />;
            break;
        case "curve":
            control = <CurveControl values={isNumberList(value) ? value : spec.defaultValue} max={spec.max}
                onChange={set} />;
            break;
        case "colorCurve":
            control = <ColorCurveControl values={isTextList(value) ? value : spec.defaultValue} onChange={set} />;
            break;
    }

    return <FieldRow label={field} hint={spec.hint} isDefault={!isSet}
        onReset={(isSet && !isRequired) ? reset : undefined}>
        {control}
    </FieldRow>;
}

function isNumber(value: unknown): value is number
{
    return typeof value == "number" && Number.isFinite(value);
}

function isRange(value: unknown): value is [number, number]
{
    return Array.isArray(value) && value.length == 2 && value.every(isNumber);
}

function isVec3(value: unknown): value is Vec3
{
    return value != null && typeof value == "object" && [(value as Vec3).x, (value as Vec3).y, (value as Vec3).z]
        .every(isNumber);
}

function isNumberList(value: unknown): value is number[]
{
    return Array.isArray(value) && value.length > 0 && value.every(isNumber);
}

function isTextList(value: unknown): value is string[]
{
    return Array.isArray(value) && value.length > 0 && value.every(v => typeof v == "string");
}

interface Props
{
    layer: ParticleLayerConfig;
    field: keyof ParticleLayerConfig;
    onEdit: (update: (layer: ParticleLayerConfig) => ParticleLayerConfig, coalesceKey?: string) => void;
}
