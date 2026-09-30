import { PARTICLE_CURVE_SAMPLES } from "../../../../../src/client/graphics/shaders/particleShader";

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

// Color stops evenly spaced over a particle's life, blended between. A new stop repeats the last.
export default function ColorCurveControl({ values, onChange }: Props)
{
    const stops = values.map(hex => COLOR_PATTERN.test(hex) ? hex.toLowerCase() : "#000000");
    const background = (stops.length == 1) ? stops[0] : `linear-gradient(to right, ${stops.join(", ")})`;

    return <div className="color-curve">
        <div className="color-gradient" style={{background}} />
        <div className="color-stops">
            {stops.map((hex, i) => <label className="color-stop" key={i} title={values[i]}>
                <input type="color" value={hex}
                    onChange={(event) => onChange(values.map((v, j) => (j == i) ? event.target.value : v))} />
                <span className="color-hex">{values[i]}</span>
            </label>)}
            <span className="color-stop-actions">
                <button type="button" className="icon-button" disabled={values.length <= 1}
                    onClick={() => onChange(values.slice(0, -1))} title="Drop the last stop">−</button>
                <button type="button" className="icon-button" disabled={values.length >= PARTICLE_CURVE_SAMPLES}
                    onClick={() => onChange([...values, values[values.length - 1]])} title="Add a stop">+</button>
            </span>
        </div>
    </div>;
}

interface Props
{
    values: string[];
    onChange: (values: string[]) => void;
}
