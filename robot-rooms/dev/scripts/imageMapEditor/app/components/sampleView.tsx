import { ReactNode } from "react";
import RgbaImage from "../../core/rgbaImage";
import ImageRecipe from "../../core/imageRecipe";
import RecipeBackground from "../../core/recipeBackground";
import SampleRenderUtil, { MAX_SAMPLE_SIDE } from "../../core/sampleRenderUtil";
import LoadedSource from "../types/loadedSource";
import SampleToolSettings from "../types/sampleToolSettings";
import usePreview from "../hooks/usePreview";
import useZoomStage from "../hooks/useZoomStage";
import SampleCanvas from "./sampleCanvas";
import ZoomControls from "./zoomControls";

// Renders are asked for in steps of this many pixels, so zooming doesn't ask for a new one at every tick.
const DETAIL_SIDE_STEP = 256;

// The sample magnified in the middle panel, for work by hand, on a zoom stage (see useZoomStage), where a drag pans
// while no tool is chosen. It is rendered from the full-size source at the resolution the zoom shows, never more
// than the saved sample has; until that lands, the side panel's render stands in.
export default function SampleView(props: Props)
{
    const { source, recipe, settings, fallback, cellSize, onChange } = props;
    // The saved sample's size: sampled, as the server does, from the source at the size it is worked at.
    const worked = SampleRenderUtil.getWorkedSourceSize(source.width, source.height);
    const own = SampleRenderUtil.getSampleSize(worked.width, worked.height, recipe);
    const stage = useZoomStage(own, settings.tool == "none");
    const neededSide = Math.max(stage.width, stage.height) * (window.devicePixelRatio || 1);
    const detailSide = Math.min(MAX_SAMPLE_SIDE, Math.max(own.width, own.height),
        Math.ceil(neededSide / DETAIL_SIDE_STEP) * DETAIL_SIDE_STEP);
    const detail = usePreview(source, recipe, settings.showRemoved, cellSize, detailSide);
    const shown = detail?.shown ?? fallback;
    const rendering = detail == undefined
        || detail.shown.width != SampleRenderUtil.getSampleSize(worked.width, worked.height, recipe, detailSide).width;

    return <section className="sample-view">
        <div className="panel-toolbar">
            {props.viewSwitch}
            <span className="panel-note">{own.width}×{own.height} px{rendering ? " · rendering…" : ""}</span>
            <ZoomControls stage={stage} fitTitle="Fit the whole sample in view"
                fullSizeTitle="One pixel of the saved sample to one pixel on screen"/>
        </div>
        <div {...stage.stageProps}>
            <div {...stage.contentProps}>
                <SampleCanvas shown={shown} recipe={recipe} settings={settings} width={stage.width} height={stage.height}
                    panning={stage.panning} pixelated={stage.width * (window.devicePixelRatio || 1) > 1.5 * shown.width}
                    startBackground={props.startBackground} focusedSelection={props.focusedSelection}
                    onFocusSelection={props.onFocusSelection} onChange={onChange}/>
            </div>
        </div>
        <div className="panel-hint">Wheel to zoom. Drag with the middle button, or hold Space, to pan
            (or just drag, with no tool chosen).</div>
    </section>;
}

interface Props
{
    source: LoadedSource;
    recipe: ImageRecipe;
    settings: SampleToolSettings;
    // The side panel's render, shown until this view's own lands.
    fallback: RgbaImage;
    cellSize: number;
    startBackground: RecipeBackground;
    focusedSelection: number | undefined;
    onFocusSelection: (index: number | undefined) => void;
    // The middle panel's Source | Sample switch.
    viewSwitch: ReactNode;
    onChange: (update: (recipe: ImageRecipe) => ImageRecipe) => void;
}
