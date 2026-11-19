import useZoomStage from "../hooks/useZoomStage";

// A zoom stage's buttons (see useZoomStage): out, in, to fit, and to the picture's own pixels.
export default function ZoomControls({ stage, fitTitle, fullSizeTitle }: Props)
{
    return <div className="zoom-controls">
        <button type="button" className="button small" onClick={stage.zoomOut} title="Zoom out">−</button>
        <span className="zoom-level">{Math.round(stage.scale * 100)}%</span>
        <button type="button" className="button small" onClick={stage.zoomIn} title="Zoom in">+</button>
        <button type="button" className={`button small${stage.fitted ? " active" : ""}`} onClick={stage.fit}
            title={fitTitle}>Fit</button>
        <button type="button" className="button small" onClick={() => stage.zoomTo(1)} title={fullSizeTitle}>100%</button>
    </div>;
}

interface Props
{
    stage: ReturnType<typeof useZoomStage>;
    fitTitle: string;
    fullSizeTitle: string;
}
