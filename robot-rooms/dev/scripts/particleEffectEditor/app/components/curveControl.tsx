import { PointerEvent, useRef, useState } from "react";
import { PARTICLE_CURVE_SAMPLES } from "../../../../../src/client/graphics/shaders/particleShader";
import ParticleParamTextureUtil from "../../../../../src/client/graphics/particle/util/particleParamTextureUtil";
import NumberUtil from "../util/numberUtil";

const DECIMALS = 2;

// Values evenly spaced over a particle's life, from birth to death, as a layer's curves are. Points are
// dragged up and down; adding or dropping one resamples the curve, so its shape stays. The shader keeps
// PARTICLE_CURVE_SAMPLES of them, so more would be lost.
export default function CurveControl({ values, max, onChange }: Props)
{
    const graphRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<number | null>(null);
    const [draft, setDraft] = useState<string | null>(null);
    const samples = values.map(v => Number.isFinite(v) ? v : 0);
    const top = Math.max(max, ...samples);
    const toX = (i: number) => (samples.length == 1) ? 50 : i / (samples.length - 1) * 100;
    const toY = (v: number) => 100 - NumberUtil.clamp(v / top, 0, 1) * 100;

    const dragTo = (index: number, event: PointerEvent<HTMLElement>) => {
        const rect = graphRef.current!.getBoundingClientRect();
        const value = NumberUtil.round(NumberUtil.clamp((1 - (event.clientY - rect.top) / rect.height) * top, 0, top),
            DECIMALS);
        if (value != samples[index])
            onChange(samples.map((v, i) => (i == index) ? value : v));
    };
    const resampled = (count: number) => ParticleParamTextureUtil.resampleCurve(samples, count)
        .map(v => NumberUtil.round(v, DECIMALS));

    return <div className="curve-control">
        <div className="curve-graph" ref={graphRef}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line className="curve-grid" x1={0} y1={toY(top / 2)} x2={100} y2={toY(top / 2)} />
                <polyline className="curve-line" points={(samples.length == 1)
                    ? `0,${toY(samples[0])} 100,${toY(samples[0])}`
                    : samples.map((v, i) => `${toX(i)},${toY(v)}`).join(" ")} />
            </svg>
            <span className="curve-axis top">{NumberUtil.format(top)}</span>
            <span className="curve-axis bottom">0</span>
            {samples.map((v, i) => <button type="button" key={i}
                className={`curve-point${dragging == i ? " dragging" : ""}`}
                style={{left: `${toX(i)}%`, top: `${toY(v)}%`}} title={NumberUtil.format(v)}
                aria-label={`Point ${i + 1}: ${v}`}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(i);
                }}
                onPointerMove={(event) => dragging == i && dragTo(i, event)}
                onPointerUp={() => setDragging(null)}
                onPointerCancel={() => setDragging(null)} />)}
        </div>
        <div className="curve-footer">
            <input type="text" className="text-input code" spellCheck={false} aria-label="Values"
                value={draft ?? samples.map(NumberUtil.format).join(", ")}
                onChange={(event) => {
                    setDraft(event.target.value);
                    const parsed = event.target.value.split(",").map(part => part.trim() == "" ? NaN : Number(part));
                    if (parsed.length >= 1 && parsed.length <= PARTICLE_CURVE_SAMPLES && parsed.every(Number.isFinite))
                        onChange(parsed);
                }}
                onBlur={() => setDraft(null)} />
            <button type="button" className="icon-button" disabled={samples.length <= 1}
                onClick={() => onChange(resampled(samples.length - 1))} title="One point fewer, the shape kept">−</button>
            <button type="button" className="icon-button" disabled={samples.length >= PARTICLE_CURVE_SAMPLES}
                onClick={() => onChange(resampled(samples.length + 1))} title="One point more, the shape kept">+</button>
        </div>
    </div>;
}

interface Props
{
    values: number[];
    max: number; // the graph's top, raised to fit any value above it
    onChange: (values: number[]) => void;
}
