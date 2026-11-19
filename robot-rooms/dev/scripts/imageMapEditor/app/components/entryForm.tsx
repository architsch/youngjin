import Draft from "../types/draft";
import ImageRecipe from "../../core/imageRecipe";
import RecipeAdjust from "../../core/recipeAdjust";
import IMAGE_LICENSES from "../../core/imageLicenses";
import RecipeBackground from "../../core/recipeBackground";
import { NO_ADJUST } from "../../core/colorAdjustUtil";
import { MAX_MARGIN } from "../../core/sampleRenderUtil";
import ImageMapSubfolderTab from "../../../../../src/shared/graphics/image/types/imageMapSubfolderTab";
import SliderRow from "./sliderRow";

// The long side, in pixels, of an image fitted to its canvas.
export const DEFAULT_LONG_SIDE = 800;
const MAX_TILT = 180; // in degrees, either way: half a turn, so any way up

// The sizes everyday objects are made at, in world units: a block's face, or half of one either way.
const SIZE_PRESETS: {label: string, width: number, height: number}[] = [
    {label: "1 × 1", width: 1, height: 1},
    {label: "1 × ½", width: 1, height: 0.5},
    {label: "½ × 1", width: 0.5, height: 1},
];

const ADJUSTMENTS: {key: keyof RecipeAdjust, label: string, min: number, max: number, unit?: string}[] = [
    {key: "brightness", label: "Brightness", min: -100, max: 100},
    {key: "contrast", label: "Contrast", min: -100, max: 100},
    {key: "saturation", label: "Saturation", min: -100, max: 100},
    {key: "hue", label: "Hue", min: -180, max: 180, unit: "°"},
    {key: "warmth", label: "Warmth", min: -100, max: 100},
    {key: "sharpness", label: "Sharpness", min: 0, max: 100},
];

// The entry's fields, and the recipe's settings not set by pointing (see SourceView, SamplePreview).
export default function EntryForm(props: Props)
{
    const { draft, subfolders, onDraftChange } = props;
    const recipe = draft.recipe;
    const setRecipe = (update: (r: ImageRecipe) => ImageRecipe, key?: string) =>
        onDraftChange(d => ({...d, recipe: update(d.recipe)}), key);
    const setAdjust = (key: keyof RecipeAdjust, value: number) =>
        setRecipe(r => ({...r, adjust: {...(r.adjust ?? NO_ADJUST), [key]: value}}), `adjust-${key}`);
    // One axis of where the sample sits in its cells, or of its margin; a pair at its default is left out.
    const setPlacement = (field: "align" | "margin", axis: 0 | 1, value: number, defaultValue: number) =>
        setRecipe(r => {
            if (!r.output.preserveScale)
                return r;
            const pair: [number, number] = [...(r.output[field] ?? [defaultValue, defaultValue])];
            pair[axis] = value;
            const {[field]: _, ...rest} = r.output;
            return {...r, output: (pair[0] == defaultValue && pair[1] == defaultValue) ? rest : {...rest, [field]: pair}};
        }, `${field}-${axis}`);

    return <section className="entry-form">
        <fieldset>
            <legend>Entry {draft.path ?? "(new)"}</legend>
            <label>Title<input value={draft.title} onChange={ev => {
                const title = ev.target.value;
                onDraftChange(d => ({...d, title}), "title");
            }}/></label>
            <label>Author<input value={draft.author} onChange={ev => {
                const author = ev.target.value;
                onDraftChange(d => ({...d, author}), "author");
            }}/></label>
            <label title="What a search in the game finds it by: single words, as a search finds each word typed anywhere in them (so one inside another, like pepper in bell pepper, is dropped on saving, as are filler words like and or of, which a search passes over). A painting leaves them out, to be found by its title and author; an everyday object names what it shows: its kind, which is what the image shows as a whole (clock; screen; plate, dish for food served on one; crate), in the word every image of that kind uses so one search finds them all, then what it holds, then the rest. The categories it is filed under are not among them: an admin sets those in the game">
                Keywords<input value={draft.keywords} placeholder="Comma-separated; none: its title and author"
                    onChange={ev => {
                        const keywords = ev.target.value;
                        onDraftChange(d => ({...d, keywords}), "keywords");
                    }}/></label>
            <label>Source<input value={draft.source} placeholder="The page it came from" onChange={ev => {
                const source = ev.target.value;
                onDraftChange(d => ({...d, source}), "source");
            }}/></label>
            <label>License<select value={draft.license} onChange={ev => {
                const license = ev.target.value;
                onDraftChange(d => ({...d, license}));
            }}>
                <option value="">Own work (no notice)</option>
                {IMAGE_LICENSES.map(license => <option key={license} value={license}>{license}</option>)}
            </select></label>
            {draft.path == undefined && <label>Tab<select value={draft.subfolder} onChange={ev => {
                const subfolder = ev.target.value;
                onDraftChange(d => ({...d, subfolder}));
            }}>
                {subfolders.map(subfolder => <option key={subfolder.name} value={subfolder.name}>{subfolder.title}</option>)}
            </select></label>}
            <label title="Enabled: in the game for everyone. Staging: built and shipped like an enabled one, but offered only on the staging and dev servers, to be tried in the game first (all listed there by a search for staging). Those servers tag every image with its number, red if staging and black if enabled. Disabled: kept, with its number, but left out of the built map; its image doesn't ship until it is enabled or staged again">
                Status<select value={draft.disabled ? "disabled" : draft.staging ? "staging" : "enabled"} onChange={ev => {
                    const status = ev.target.value;
                    onDraftChange(d => ({...d, disabled: status == "disabled", staging: status == "staging"}));
                }}>
                    <option value="enabled">Enabled</option>
                    <option value="staging">Staging (not on the live server)</option>
                    <option value="disabled">Disabled (left out of the game)</option>
                </select></label>
        </fieldset>

        <fieldset>
            <legend>Size in the game</legend>
            <label className="checkbox"><input type="checkbox" checked={recipe.output.preserveScale} onChange={ev => {
                const preserveScale = ev.target.checked;
                setRecipe(r => ({...r, output: preserveScale
                    ? {preserveScale: true, numCols: toCells(1, props.cellWorldSize), numRows: toCells(1, props.cellWorldSize)}
                    : {preserveScale: false, longSide: DEFAULT_LONG_SIDE}}));
            }}/>Keep its own scale (a prop showing it is its size)</label>
            {recipe.output.preserveScale
                ? <>
                    <div className="row">
                        {SIZE_PRESETS.map(preset => {
                            const numCols = toCells(preset.width, props.cellWorldSize);
                            const numRows = toCells(preset.height, props.cellWorldSize);
                            const active = recipe.output.preserveScale && recipe.output.numCols == numCols
                                && recipe.output.numRows == numRows;
                            return <button key={preset.label} type="button" className={`button small${active ? " active" : ""}`}
                                onClick={() => setRecipe(r => ({...r, output: r.output.preserveScale
                                    ? {...r.output, numCols, numRows} : {preserveScale: true, numCols, numRows}}))}>
                                {preset.label}</button>;
                        })}
                    </div>
                    <div className="row">
                        <label>Cells across<input type="number" min={1} max={props.maxCells} value={recipe.output.numCols}
                            onChange={ev => {
                                const numCols = clampCells(ev.target.valueAsNumber, props.maxCells);
                                setRecipe(r => r.output.preserveScale ? {...r, output: {...r.output, numCols}} : r, "cols");
                            }}/></label>
                        <label>Cells down<input type="number" min={1} max={props.maxCells} value={recipe.output.numRows}
                            onChange={ev => {
                                const numRows = clampCells(ev.target.valueAsNumber, props.maxCells);
                                setRecipe(r => r.output.preserveScale ? {...r, output: {...r.output, numRows}} : r, "rows");
                            }}/></label>
                        <span className="panel-note">{recipe.output.numCols * props.cellWorldSize} x {recipe.output.numRows
                            * props.cellWorldSize} units, {recipe.output.numCols * props.cellSize} x {recipe.output.numRows
                            * props.cellSize} px; the sample is {recipe.output.stretch ? "stretched to fill them"
                            : "fitted inside"}</span>
                    </div>
                    <label className="checkbox" title="Resizes the sample to fill its cells exactly, wider or taller than it is, instead of fitting it inside them at its own shape and leaving room beside it. With an extra margin, it fills what that leaves">
                        <input type="checkbox" checked={recipe.output.stretch === true} onChange={ev => {
                            const stretch = ev.target.checked;
                            setRecipe(r => {
                                if (!r.output.preserveScale)
                                    return r;
                                const {stretch: _, ...rest} = r.output;
                                return {...r, output: stretch ? {...rest, stretch} : rest};
                            });
                        }}/>Stretch the sample to fill its cells</label>
                    <SliderRow label="Place across" min={0} max={100} step={1} unit="%" defaultValue={50}
                        value={Math.round((recipe.output.align?.[0] ?? 0.5) * 100)}
                        title="Where the sample sits across the room its cells leave beside it: 0 at the left, 100 at the right"
                        onChange={percent => setPlacement("align", 0, percent / 100, 0.5)}/>
                    <SliderRow label="Place down" min={0} max={100} step={1} unit="%" defaultValue={50}
                        value={Math.round((recipe.output.align?.[1] ?? 0.5) * 100)}
                        title="Where the sample sits down the room its cells leave above and below it: 0 at the top, 100 at the bottom"
                        onChange={percent => setPlacement("align", 1, percent / 100, 0.5)}/>
                    <div className="row" title="Room kept clear around the sample besides, as a share of the cells' width or height, to show it smaller than its cells">
                        <label>Extra margin across (%)<input type="number" min={0} max={MAX_MARGIN * 100} step={1}
                            value={Math.round((recipe.output.margin?.[0] ?? 0) * 100)}
                            onChange={ev => setPlacement("margin", 0, clampMargin(ev.target.valueAsNumber), 0)}/></label>
                        <label>Extra margin down (%)<input type="number" min={0} max={MAX_MARGIN * 100} step={1}
                            value={Math.round((recipe.output.margin?.[1] ?? 0) * 100)}
                            onChange={ev => setPlacement("margin", 1, clampMargin(ev.target.valueAsNumber), 0)}/></label>
                    </div>
                </>
                : <label>Long side (px)<input type="number" min={64} max={2048} value={recipe.output.longSide}
                    onChange={ev => {
                        const longSide = Math.max(1, Math.round(ev.target.valueAsNumber || DEFAULT_LONG_SIDE));
                        setRecipe(r => r.output.preserveScale ? r : {...r, output: {preserveScale: false, longSide}}, "longSide");
                    }}/></label>}
        </fieldset>

        <fieldset>
            <legend>Sampled area</legend>
            <label className="checkbox"><input type="checkbox" checked={props.keepRectangle}
                onChange={ev => props.setKeepRectangle(ev.target.checked)}/>Keep it a rectangle (off: straighten a
                face seen at an angle)</label>
            <SliderRow label="Tilt" min={-MAX_TILT} max={MAX_TILT} step={0.1} value={recipe.rotation ?? 0} unit="°"
                defaultValue={0} title="Turn the picture clockwise, by up to half a turn either way: to straighten a tilted photo, or to stand up a thing that lies on its side or upside down. The area sampled turns the other way on the source, about its middle"
                onChange={rotation => setRecipe(r => ({...r, rotation: rotation || undefined}), "rotation")}/>
            <div className="row">
                <button type="button" className="button small" onClick={() =>
                    setRecipe(r => ({...r, corners: [[0, 0], [1, 0], [1, 1], [0, 1]]}))}>Whole image</button>
                <button type="button" className="button small" disabled={recipe.retouches.length == 0}
                    onClick={() => setRecipe(r => ({...r, retouches: []}))}>
                    Clear {recipe.retouches.length} retouch{recipe.retouches.length == 1 ? "" : "es"}</button>
            </div>
        </fieldset>

        <fieldset>
            <legend>Background</legend>
            <label className="checkbox"><input type="checkbox" checked={recipe.background != undefined} onChange={ev => {
                const on = ev.target.checked;
                setRecipe(r => ({...r, background: on ? {...props.startBackground} : undefined}));
            }}/>Take out the background (its thresholds are over the sample)</label>
            {recipe.background != undefined && <>
                <div className="row">
                    <button type="button" className="button small" disabled={recipe.background.seeds.length == 0}
                        onClick={() => setRecipe(r => ({...r, background: {...r.background!, seeds: []}}))}>
                        Clear {recipe.background.seeds.length} mark{recipe.background.seeds.length == 1 ? "" : "s"}</button>
                </div>
                <label className="checkbox"><input type="checkbox" checked={recipe.background.fromBorder} onChange={ev => {
                    const fromBorder = ev.target.checked;
                    setRecipe(r => ({...r, background: {...r.background!, fromBorder}}));
                }}/>Everything like the border around it</label>
                <label className="checkbox"><input type="checkbox" checked={recipe.background.keepLargest}
                    onChange={ev => {
                        const keepLargest = ev.target.checked;
                        setRecipe(r => ({...r, background: {...r.background!, keepLargest}}));
                    }}/>Keep only the largest piece</label>
            </>}
        </fieldset>

        <fieldset>
            <legend>Color</legend>
            {ADJUSTMENTS.map(({key, label, min, max, unit}) => <SliderRow key={key} label={label} min={min} max={max}
                step={1} unit={unit} value={recipe.adjust?.[key] ?? 0} defaultValue={0}
                onChange={value => setAdjust(key, value)}/>)}
            <div className="row">
                <button type="button" className="button small" disabled={recipe.adjust == undefined}
                    onClick={() => setRecipe(r => ({...r, adjust: undefined}))}>Reset all</button>
            </div>
        </fieldset>
    </section>;
}

function toCells(worldSize: number, cellWorldSize: number): number
{
    return Math.max(1, Math.round(worldSize / cellWorldSize));
}

function clampCells(value: number, maxCells: number): number
{
    return Math.min(maxCells, Math.max(1, Math.round(value || 1)));
}

// A margin typed in percent, as a share.
function clampMargin(percent: number): number
{
    return Math.min(MAX_MARGIN, Math.max(0, Math.round(percent || 0) / 100));
}

interface Props
{
    draft: Draft;
    subfolders: ImageMapSubfolderTab[];
    onDraftChange: (update: (draft: Draft) => Draft, coalesceKey?: string) => void;
    // What the background fill is when turned back on (see EditorApp).
    startBackground: RecipeBackground;
    keepRectangle: boolean;
    setKeepRectangle: (keepRectangle: boolean) => void;
    maxCells: number;
    cellSize: number;
    cellWorldSize: number;
}
