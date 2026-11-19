// How the editor shows one layer field (see LayerFieldSpecMap). Slider bounds are for dragging; a typed value
// may go past them. A field with a default may be left out of the layer, which then takes the default.
type LayerFieldSpec = {hint: string} & (
    | {kind: "sprite"}
    | {kind: "choice", options: string[], defaultValue: string}
    | {kind: "toggle", defaultValue: boolean}
    | {kind: "number", min: number, max: number, step: number, defaultValue: number, unit?: string}
    | {kind: "range", min: number, max: number, step: number, defaultValue?: [number, number], unit?: string}
    | {kind: "halfSize", max: number, step: number}
    | {kind: "curve", max: number, defaultValue: number[]}
    | {kind: "colorCurve", defaultValue: string[]}
);

export default LayerFieldSpec;
