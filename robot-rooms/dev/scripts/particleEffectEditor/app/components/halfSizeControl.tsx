import Vec3 from "../../../../../src/shared/math/types/vec3";
import NumberControl from "./numberControl";

const AXES = ["x", "y", "z"] as const;

// Half the spawn box on each of the effect's axes: x and y across its direction, z along it.
export default function HalfSizeControl({ value, max, step, onChange }: Props)
{
    return <div className="half-size-control">
        {AXES.map(axis => <div className="axis-row" key={axis}>
            <span className="axis-label">{axis}</span>
            <NumberControl value={value[axis]} min={0} max={max} step={step} unit="m"
                onChange={(next) => onChange({...value, [axis]: next})} />
        </div>)}
    </div>;
}

interface Props
{
    value: Vec3;
    max: number;
    step: number;
    onChange: (value: Vec3) => void;
}
