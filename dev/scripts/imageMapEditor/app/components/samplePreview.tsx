import { useEffect, useRef } from "react";
import RgbaImage from "../../core/rgbaImage";
import ImageRecipe from "../../core/imageRecipe";
import RecipeBackground from "../../core/recipeBackground";
import RecipeSelection from "../../core/recipeSelection";
import ImageProcessingUtil from "../../core/imageProcessingUtil";
import PixelUtil from "../util/pixelUtil";
import useFitSize from "../hooks/useFitSize";
import SampleTool from "../types/sampleTool";
import SampleToolSettings from "../types/sampleToolSettings";
import SliderRow from "./sliderRow";
import NumberField from "./numberField";
import SampleCanvas from "./sampleCanvas";

export const DEFAULT_BACKGROUND: RecipeBackground = {fromBorder: true, seeds: [], tolerance: 14, step: 4, keepLargest: true};
export const DEFAULT_STEP = 4;

const TOOLS: {tool: SampleTool, label: string, title: string}[] = [
    {tool: "mark", label: "Mark background", title: "Click the background to fill it out from there (Alt-click undoes a mark)"},
    {tool: "erase", label: "Erase", title: "Brush over what to take out"},
    {tool: "restore", label: "Restore", title: "Brush over what to bring back"},
    {tool: "eraseColor", label: "Erase color", title: "Click a color to take it out wherever it is"},
    {tool: "select", label: "Select", title: "Drag out a selection to keep, as a rectangle or an ellipse (Shift: a square or a circle). "
        + "Click one to pick it; drag inside it to move it, its handles to resize it (Shift keeps its shape) and the knob above it to turn it (Shift: in steps)"},
];
const WHOLE_SAMPLE: RecipeSelection["rect"] = [0, 0, 1, 1];
const FALLBACK_FILL = "#ffffff";

// The sample as the recipe makes it, on a checkerboard so what is taken out shows (or tinted, with "Show removed"),
// and the tools that take things out of it: background marks for the fill, the fill's thresholds, brushes, a color
// taken out everywhere, and the selections it is cut to, listed so one can be picked and set. Magnified in the
// middle panel on asking (see SampleView). Beside it, the game image at its own pixels.
export default function SamplePreview(props: Props)
{
    const { shown, gameImage, gameImageLabel, recipe, settings, magnified, focusedSelection, onFocusSelection,
        onSettingsChange, onChange } = props;
    const stageRef = useRef<HTMLDivElement>(null);
    const gameCanvasRef = useRef<HTMLCanvasElement>(null);
    const frameSize = useFitSize(stageRef, shown.width / shown.height);

    useEffect(() => draw(gameCanvasRef.current!, gameImage), [gameImage]);

    const brushing = settings.tool == "erase" || settings.tool == "restore";
    const setBackground = (update: (background: RecipeBackground) => RecipeBackground, key?: string) =>
        onChange(r => ({...r, background: update(r.background ?? props.startBackground)}), key);

    const background = recipe.background;
    const selections = recipe.selections ?? [];
    const focused = (focusedSelection != undefined && focusedSelection < selections.length) ? focusedSelection : undefined;
    const selection = (focused != undefined) ? selections[focused] : undefined;
    const setSelection = (update: (selection: RecipeSelection) => RecipeSelection, key?: string) => {
        if (focused == undefined)
            return;
        onChange(r => (r.selections?.[focused] == undefined) ? r
            : {...r, selections: r.selections.map((other, i) => (i == focused) ? update(other) : other)},
            key && `${key}-${focused}`);
    };
    const addSelection = (added: RecipeSelection) => {
        onChange(r => ({...r, selections: [...(r.selections ?? []), added]}));
        onFocusSelection(selections.length);
    };
    const removeSelection = (index: number) => {
        onChange(r => {
            const rest = (r.selections ?? []).filter((_, i) => i != index);
            return {...r, selections: (rest.length > 0) ? rest : undefined};
        });
        if (focused != undefined && focused >= index)
            onFocusSelection((focused == index) ? undefined : focused - 1);
    };
    const selectShape = selection?.shape ?? settings.selectShape;
    const setShape = (shape: RecipeSelection["shape"]) => {
        onSettingsChange({selectShape: shape});
        setSelection(s => ({...s, shape}));
    };
    return <section className="sample-preview">
        <div className="panel-toolbar">
            <span className="panel-title">Sample</span>
            <button type="button" className={`button small${magnified ? " active" : ""}`} onClick={props.onToggleMagnified}
                title="Show the sample large in the middle, to zoom in and work on it by hand">
                {magnified ? "Back to the source" : "Magnify"}</button>
            <div className="segmented">
                {TOOLS.map(({tool, label, title}) => <button key={tool} type="button" title={title}
                    className={settings.tool == tool ? "active" : ""}
                    onClick={() => onSettingsChange({tool: settings.tool == tool ? "none" : tool})}>{label}</button>)}
            </div>
        </div>
        <div className="sample-tools">
            {background != undefined && <>
                <SliderRow label="Tolerance" min={0} max={60} step={0.5} value={background.tolerance}
                    title="How far a color may be from the one its fill started at (CIELAB distance)"
                    onChange={tolerance => setBackground(b => ({...b, tolerance}), "tolerance")}/>
                <div className="slider-row">
                    <label className="checkbox" title="Stop where neighboring pixels differ by more than this, so a fill follows shading but not an edge">
                        <input type="checkbox" checked={background.step != undefined}
                            onChange={ev => {
                                const step = ev.target.checked ? props.startStep : undefined;
                                setBackground(b => ({...b, step}));
                            }}/>Edge stop</label>
                    {background.step != undefined && <>
                        <input type="range" min={0.5} max={30} step={0.5} value={background.step}
                            onChange={ev => {
                                const step = ev.target.valueAsNumber;
                                setBackground(b => ({...b, step}), "step");
                            }}/>
                        <NumberField value={background.step} min={0.5} max={30} step={0.5}
                            onChange={step => setBackground(b => ({...b, step}), "step")}/>
                    </>}
                </div>
            </>}
            {brushing && <SliderRow label="Brush" min={0.1} max={30} step={0.1} value={settings.brushRadius} unit="%"
                title="The brush's radius, as a share of the sample's shorter side"
                onChange={brushRadius => onSettingsChange({brushRadius})}/>}
            {settings.tool == "eraseColor" && <SliderRow label="Color tolerance" min={0.5} max={40} step={0.5}
                value={settings.colorTolerance} title="How close to the clicked color a pixel must be to go (CIELAB distance)"
                onChange={colorTolerance => onSettingsChange({colorTolerance})}/>}
            {(settings.tool == "select" || selections.length > 0) && <div className="slider-row">
                <span className="slider-label">Selections</span>
                <div className="segmented" title="The shape of the selection picked, and of those drawn next">
                    <button type="button" className={selectShape == "rect" ? "active" : ""}
                        onClick={() => setShape("rect")}>Rectangle</button>
                    <button type="button" className={selectShape == "ellipse" ? "active" : ""}
                        onClick={() => setShape("ellipse")}>Ellipse</button>
                </div>
                <button type="button" className="button small" title="Add a selection of the whole sample, in the shape chosen"
                    onClick={() => addSelection({shape: selectShape, rect: WHOLE_SAMPLE, radius: 0})}>Whole sample</button>
                {selections.length > 0 && <button type="button" className="button small"
                    onClick={() => {
                        onChange(r => ({...r, selections: undefined}));
                        onFocusSelection(undefined);
                    }}>Clear all</button>}
            </div>}
            {selections.length > 0 && <ol className="selection-list"
                title="Each takes out (or fills) what lies outside it, together with the others">
                {selections.map((other, i) => <li key={i} className={i == focused ? "focused" : ""}
                    onClick={() => onFocusSelection(i == focused ? undefined : i)}>
                    <span className="selection-name">{i + 1}. {other.shape == "rect" ? "Rectangle" : "Ellipse"}
                        {other.angle ? `, turned ${formatDegrees(other.angle)}°` : ""}</span>
                    <span className="panel-note">{other.fill != undefined ? "fills outside" : "takes out outside"}</span>
                    <button type="button" className="button small" title="Remove this selection"
                        onClick={ev => {
                            ev.stopPropagation();
                            removeSelection(i);
                        }}>Remove</button>
                </li>)}
            </ol>}
            {selection?.shape == "rect" && <SliderRow label="Corners" min={0} max={50} step={1} unit="%"
                value={Math.round(selection.radius * 100)} defaultValue={0}
                title="How round the rectangle's corners are, as a share of its shorter side"
                onChange={percent => setSelection(s => ({...s, radius: percent / 100}), "selectionRadius")}/>}
            {selection != undefined && <SliderRow label="Angle" min={-180} max={180} step={0.5} unit="°"
                value={selection.angle ?? 0} defaultValue={0}
                title="How far the selection is turned clockwise about its middle (or drag the knob above it)"
                onChange={angle => setSelection(s => ({...s, angle: angle || undefined}), "selectionAngle")}/>}
            {selection != undefined && <div className="slider-row" title="What becomes of what lies outside the selection">
                <span className="slider-label">Outside</span>
                <div className="segmented">
                    <button type="button" className={selection.fill == undefined ? "active" : ""}
                        onClick={() => setSelection(s => ({...s, fill: undefined}))}>See-through</button>
                    <button type="button" className={selection.fill != undefined ? "active" : ""}
                        onClick={() => setSelection(s => ({...s, fill: s.fill ?? getEdgeColor(shown)}))}>Color</button>
                </div>
                {selection.fill != undefined && <input type="color" value={selection.fill}
                    onChange={ev => {
                        const fill = ev.target.value;
                        setSelection(s => ({...s, fill}), "selectionFill");
                    }}/>}
            </div>}
            <div className="slider-row">
                <label className="checkbox"><input type="checkbox" checked={settings.showRemoved}
                    onChange={ev => onSettingsChange({showRemoved: ev.target.checked})}/>Show removed</label>
                {(recipe.alphaEdits?.length ?? 0) > 0 && <button type="button" className="button small"
                    onClick={() => onChange(r => ({...r, alphaEdits: undefined}))}>
                    Clear {recipe.alphaEdits!.length} hand edit{recipe.alphaEdits!.length == 1 ? "" : "s"}</button>}
            </div>
        </div>
        <div className="sample-stage" ref={stageRef}>
            <SampleCanvas shown={shown} recipe={recipe} settings={settings} width={frameSize.width}
                height={frameSize.height} startBackground={props.startBackground} focusedSelection={focused}
                onFocusSelection={onFocusSelection} onChange={onChange}/>
        </div>
        <div className="game-image-preview">
            <div className="checkerboard game-image-frame">
                <canvas ref={gameCanvasRef}/>
            </div>
            <span className="panel-note">{gameImageLabel}</span>
        </div>
    </section>;
}

// The color around the sample's edge, as "#rrggbb", which is where a fill usually starts from.
function getEdgeColor(image: RgbaImage): string
{
    const [r, g, b, a] = ImageProcessingUtil.getMarginColor(image);
    return (a == 0) ? FALLBACK_FILL : `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function formatDegrees(degrees: number): string
{
    return String(Math.round(degrees * 10) / 10);
}

function draw(canvas: HTMLCanvasElement, image: RgbaImage): void
{
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d")!.drawImage(PixelUtil.toCanvas(image), 0, 0);
}

interface Props
{
    shown: RgbaImage;
    gameImage: RgbaImage;
    gameImageLabel: string;
    recipe: ImageRecipe;
    settings: SampleToolSettings;
    magnified: boolean;
    // What the background fill is, and its edge stop, when turned back on: as last set for this entry, or the
    // defaults (see EditorApp).
    startBackground: RecipeBackground;
    startStep: number;
    focusedSelection: number | undefined;
    onFocusSelection: (index: number | undefined) => void;
    onToggleMagnified: () => void;
    onSettingsChange: (update: Partial<SampleToolSettings>) => void;
    onChange: (update: (recipe: ImageRecipe) => ImageRecipe, coalesceKey?: string) => void;
}
