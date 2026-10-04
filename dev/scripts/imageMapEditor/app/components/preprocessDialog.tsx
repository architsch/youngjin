import { useEffect, useRef, useState } from "react";
import useHistory from "../../../compositionEditor/app/hooks/useHistory";
import SourceEntry from "../../core/sourceEntry";
import SourcePrep from "../../core/sourcePrep";
import PrepPreview from "../../core/prepPreview";
import SampleRenderUtil from "../../core/sampleRenderUtil";
import PrepCutOut from "../../../imagePrep/core/prepCutOut";
import EditorApi from "../util/editorApi";
import useZoomStage from "../hooks/useZoomStage";
import PrepTool from "../types/prepTool";
import PrepCanvas from "./prepCanvas";
import ZoomControls from "./zoomControls";
import SliderRow from "./sliderRow";

// Where a squared face's corners start, to be dragged onto the face's own.
const START_CORNERS: [number, number][] = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]];
// An ellipse takes this many points (see PlaneGeometryUtil.fitEllipse).
const MIN_ROUND_POINTS = 5;
const SIDES = ["Left", "Top", "Right", "Bottom"];
const MAX_EXTEND_PERCENT = 300;

const CUT_OUT_TOOLS: {tool: PrepTool, label: string, title: string}[] = [
    {tool: "box", label: "Box", title: "Drag a box close around the thing"},
    {tool: "on", label: "Point on", title: "Click a point on each stretch of the thing that looks unlike the rest "
        + "(Alt-click takes the nearest one away)"},
    {tool: "off", label: "Point off", title: "Click what the model took for the thing and isn't "
        + "(Alt-click takes the nearest one away)"},
];

// A source preprocessed into another (see SourcePreprocessor), set by pointing at it on a zoom stage: the things
// kept cut out of their background by a model shown each with a box and points, and a face seen at an angle squared
// up or something round made round. A preview shows the result, and tints what a cut-out takes away over the
// source, where the next points are read off; adding it leaves the source as it is.
export default function PreprocessDialog({ source, startPrep, onAdded, onClose }: Props)
{
    const dialogRef = useRef<HTMLDialogElement>(null);
    const history = useHistory<SourcePrep>(startPrep ?? {});
    const prep = history.present;
    const [tool, setTool] = useState<PrepTool>("none");
    const [focusedPart, setFocusedPart] = useState(0);
    // The last preview, with what was asked for it, to tell when it no longer shows what is set.
    const [preview, setPreview] = useState<{asked: string, result: PrepPreview}>();
    const [showCutAway, setShowCutAway] = useState(true);
    const [busy, setBusy] = useState<"preview" | "add">();
    const [error, setError] = useState<string>();
    const own = SampleRenderUtil.getWorkedSourceSize(source.width, source.height);
    const stage = useZoomStage(own, true);

    useEffect(() => {
        if (dialogRef.current?.open === false)
            dialogRef.current.showModal();
    }, []);

    const parts = prep.cutOut ?? [];
    const focused = Math.min(focusedPart, parts.length);
    const part: PrepCutOut | undefined = parts[focused];
    const reshape = (prep.square != undefined) ? "square" : (prep.round != undefined) ? "round" : "none";
    const shape = (prep.square?.circle != undefined) ? "circle" : (prep.square?.aspect != undefined) ? "aspect" : "sides";
    const roundCount = (prep.square?.circle ?? prep.round?.outline ?? []).length;
    const sent = toSent(prep);
    const asked = JSON.stringify(sent);
    const problem = (Object.keys(sent).length == 0) ? "Nothing is asked of it yet: cut a thing out of it, or reshape it."
        : ((shape == "circle" || reshape == "round") && roundCount < MIN_ROUND_POINTS)
            ? `Mark ${MIN_ROUND_POINTS} points or more around the round thing's outline.`
        : undefined;

    const setParts = (update: (parts: PrepCutOut[]) => PrepCutOut[]) => history.commit(p => {
        const cutOut = update(p.cutOut ?? []);
        return {...p, cutOut: (cutOut.length > 0) ? cutOut : undefined};
    });
    const setReshape = (next: "none" | "square" | "round") => {
        history.commit(p => ({...p, square: (next == "square") ? (p.square ?? {corners: START_CORNERS}) : undefined,
            round: (next == "round") ? (p.round ?? {outline: []}) : undefined}));
        setTool((next == "round") ? "outline" : "none");
    };
    const setShape = (next: "sides" | "aspect" | "circle") => {
        history.commit(p => (p.square == undefined) ? p : {...p, square: {...p.square,
            aspect: (next == "aspect") ? (p.square.aspect ?? 1) : undefined,
            circle: (next == "circle") ? (p.square.circle ?? []) : undefined}});
        setTool((next == "circle") ? "circle" : "none");
    };

    const run = async (kind: "preview" | "add", fetchTools: boolean = false) => {
        setBusy(kind);
        setError(undefined);
        try
        {
            const result = (kind == "preview") ? await EditorApi.previewPreparedSource(source.sha1, sent, fetchTools)
                : await EditorApi.addPreparedSource(source.sha1, sent, fetchTools);
            if ("needsTools" in result)
            {
                if (confirm(result.needsTools))
                    await run(kind, true);
            }
            else if ("notes" in result)
            {
                setPreview({asked, result});
            }
            else
            {
                onAdded(result);
                dialogRef.current?.close();
            }
        }
        catch (err)
        {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally
        {
            setBusy(undefined);
        }
    };

    // What was marked is only kept by adding the result.
    const confirmClose = () => !history.canUndo || confirm("Close without adding it to the library? What is set here is lost.");

    return <dialog ref={dialogRef} className="prep-dialog" onClose={onClose}
        onCancel={ev => {
            if (!confirmClose())
                ev.preventDefault();
        }}
        onKeyDown={ev => {
            if (!(ev.metaKey || ev.ctrlKey) || ev.key.toLowerCase() != "z" || (ev.target as HTMLElement).tagName == "INPUT")
                return;
            ev.preventDefault();
            if (ev.shiftKey)
                history.redo();
            else
                history.undo();
        }}>
        <div className="panel-toolbar">
            <span className="panel-title source-name" title={source.fileName}>Preprocess {source.fileName}</span>
            <span className="panel-note">{source.width}x{source.height}</span>
            <button type="button" className="button small" disabled={!history.canUndo} onClick={history.undo}
                title="Undo (Ctrl+Z)">Undo</button>
            <button type="button" className="button small" disabled={!history.canRedo} onClick={history.redo}
                title="Redo (Ctrl+Shift+Z)">Redo</button>
            <ZoomControls stage={stage} fitTitle="Fit the whole source in view"
                fullSizeTitle="One pixel of the source, as it is worked at, to one pixel on screen"/>
            <button type="button" className="button small" onClick={() => {
                if (confirmClose())
                    dialogRef.current?.close();
            }}>Close</button>
        </div>
        <div className="prep-body">
            <div className="prep-stage">
                <div {...stage.stageProps}>
                    <div {...stage.contentProps}>
                        <PrepCanvas source={source} own={own} prep={prep} tool={tool} focusedPart={focused}
                            width={stage.width} height={stage.height} spaceHeld={stage.spaceHeld}
                            pixelated={stage.width * (window.devicePixelRatio || 1) > 1.5 * own.width}
                            cutAway={showCutAway ? preview?.result.cutAway : undefined} onChange={history.commit}/>
                    </div>
                </div>
                <div className="panel-hint">Wheel to zoom. Drag with the middle button, or hold Space, to pan
                    (or just drag, with no tool chosen).</div>
            </div>
            <section className="entry-form prep-side">
                <fieldset>
                    <legend>Cut out of its background</legend>
                    <span className="panel-note">A model (Segment Anything 2) tells a thing's own pixels from the rest,
                        shown a box close around it and a point on each stretch of it that looks unlike the rest.
                        One part for each thing the eye takes as one.</span>
                    <div className="row">
                        <div className="segmented">
                            {CUT_OUT_TOOLS.map(({tool: other, label, title}) => <button key={other} type="button"
                                title={title} className={tool == other ? "active" : ""}
                                onClick={() => setTool(tool == other ? "none" : other)}>{label}</button>)}
                        </div>
                        <button type="button" className="button small" disabled={parts.length == 0}
                            title="Another thing kept, or one standing in front of the others to take out of them"
                            onClick={() => {
                                setParts(all => [...all, {}]);
                                setFocusedPart(parts.length);
                                setTool("box");
                            }}>Add part</button>
                    </div>
                    {parts.length > 0 && <ol className="selection-list" title="The box and the points go to the part picked">
                        {parts.map((other, i) => <li key={i} className={i == focused ? "focused" : ""}
                            onClick={() => setFocusedPart(i)}>
                            <span className="selection-name">{i + 1}. {describePart(other)}</span>
                            <span className="panel-note">{other.drop ? "taken out" : "kept"}</span>
                            <button type="button" className="button small" title="Remove this part"
                                onClick={ev => {
                                    ev.stopPropagation();
                                    // The first part left is one kept: nothing is there to take it out of.
                                    setParts(all => all.filter((_, j) => j != i).map((kept, j) =>
                                        (j == 0 && kept.drop) ? {...kept, drop: undefined} : kept));
                                    setFocusedPart(Math.max(0, (focused > i) ? focused - 1 : Math.min(focused, parts.length - 2)));
                                }}>Remove</button>
                        </li>)}
                    </ol>}
                    {part != undefined && focused > 0 && <label className="checkbox">
                        <input type="checkbox" checked={part.drop === true} onChange={ev => {
                            const drop = ev.target.checked || undefined;
                            setParts(all => all.map((other, i) => (i == focused) ? {...other, drop} : other));
                        }}/>Take it out of the parts before it (something standing in front)</label>}
                    <label className="checkbox" title="Every piece far smaller than the largest, and any haze away from the pieces kept">
                        <input type="checkbox" checked={prep.tidy === true} onChange={ev => {
                            const tidy = ev.target.checked || undefined;
                            history.commit(p => ({...p, tidy}));
                        }}/>Drop the specks left around it</label>
                </fieldset>

                <fieldset>
                    <legend>Reshape</legend>
                    <div className="row">
                        <div className="segmented">
                            <button type="button" className={reshape == "none" ? "active" : ""}
                                onClick={() => setReshape("none")}>None</button>
                            <button type="button" className={reshape == "square" ? "active" : ""}
                                title="A flat face seen at an angle, its four corners taken to a rectangle's"
                                onClick={() => setReshape("square")}>Square a face</button>
                            <button type="button" className={reshape == "round" ? "active" : ""}
                                title="Something round seen at an angle (a plate, a clock), stretched across its short axis"
                                onClick={() => setReshape("round")}>Make round</button>
                        </div>
                    </div>
                    {prep.square != undefined && <>
                        <span className="panel-note">Drag the corners onto the face's own. Whatever stands up from the
                            face leans away with it.</span>
                        <div className="row" title="The face's real shape, which a steep view doesn't show: as its sides are seen (right only nearly head-on), its width over its height where that is known, or what makes something round in its plane round again">
                            <span>Shape by</span>
                            <div className="segmented">
                                <button type="button" className={shape == "sides" ? "active" : ""}
                                    onClick={() => setShape("sides")}>Its sides</button>
                                <button type="button" className={shape == "aspect" ? "active" : ""}
                                    onClick={() => setShape("aspect")}>Width / height</button>
                                <button type="button" className={shape == "circle" ? "active" : ""}
                                    onClick={() => setShape("circle")}>Something round</button>
                            </div>
                        </div>
                        {shape == "aspect" && <label>Width over height<input type="number" min={0.05} max={20} step={0.01}
                            value={prep.square.aspect} onChange={ev => {
                                const aspect = Math.min(20, Math.max(0.05, ev.target.valueAsNumber || 1));
                                history.commit(p => (p.square == undefined) ? p : {...p, square: {...p.square, aspect}}, "aspect");
                            }}/></label>}
                        <span className="panel-note">Room kept past the face's edges, as a share of its width or height,
                            for what of the thing lies beyond it:</span>
                        <div className="row">
                            {SIDES.map((side, i) => <label key={side}>{side} (%)<input type="number" min={0}
                                max={MAX_EXTEND_PERCENT} step={1} value={Math.round((prep.square!.extend?.[i] ?? 0) * 100)}
                                onChange={ev => {
                                    const share = Math.min(MAX_EXTEND_PERCENT, Math.max(0, Math.round(ev.target.valueAsNumber || 0))) / 100;
                                    history.commit(p => {
                                        if (p.square == undefined)
                                            return p;
                                        const extend = [...(p.square.extend ?? [0, 0, 0, 0])] as [number, number, number, number];
                                        extend[i] = share;
                                        return {...p, square: {...p.square, extend: extend.some(value => value > 0) ? extend : undefined}};
                                    }, `extend-${i}`);
                                }}/></label>)}
                        </div>
                    </>}
                    {(shape == "circle" || prep.round != undefined) && <div className="row">
                        <button type="button" className={`button small${(tool == "circle" || tool == "outline") ? " active" : ""}`}
                            title="Click points spread around the round thing's outline (Alt-click takes the nearest one away)"
                            onClick={() => {
                                const marking: PrepTool = (prep.round != undefined) ? "outline" : "circle";
                                setTool(tool == marking ? "none" : marking);
                            }}>Mark its outline</button>
                        <span className="panel-note">{roundCount} point{roundCount == 1 ? "" : "s"} ({MIN_ROUND_POINTS} or more)</span>
                        <button type="button" className="button small" disabled={roundCount == 0}
                            onClick={() => history.commit(p => (p.round != undefined) ? {...p, round: {...p.round, outline: []}}
                                : (p.square != undefined) ? {...p, square: {...p.square, circle: []}} : p)}>Clear</button>
                    </div>}
                    {prep.round != undefined && <SliderRow label="Turn" min={-180} max={180} step={1} unit="°"
                        value={prep.round.turn ?? 0} defaultValue={0} title="Degrees the result is turned clockwise"
                        onChange={turn => history.commit(p => (p.round == undefined) ? p
                            : {...p, round: {...p.round, turn: turn || undefined}}, "turn")}/>}
                </fieldset>

                <fieldset>
                    <legend>Result</legend>
                    <span className="panel-note">Added to the library beside this source, which stays as it is, with
                        its address, author and license.</span>
                    <div className="row">
                        <button type="button" className="button" disabled={busy != undefined || problem != undefined}
                            onClick={() => run("preview")}>{busy == "preview" ? "Working…" : "Preview"}</button>
                        <button type="button" className="button primary" disabled={busy != undefined || problem != undefined}
                            onClick={() => run("add")}>{busy == "add" ? "Working…" : "Add to the library"}</button>
                    </div>
                    {problem != undefined && <span className="panel-note">{problem}</span>}
                    {busy != undefined && <span className="panel-note">A thing's first cut-out takes a while.</span>}
                    {error != undefined && <div className="banner error" role="alert">
                        <span className="banner-message">{error}</span></div>}
                    {preview != undefined && <>
                        <div className="checkerboard prep-result"><img src={preview.result.image} alt=""/></div>
                        <span className="panel-note">{preview.result.width} x {preview.result.height} px
                            {preview.asked != asked ? "; out of date since what is set changed" : ""}</span>
                        {preview.result.cutAway != undefined && <label className="checkbox">
                            <input type="checkbox" checked={showCutAway} onChange={ev => setShowCutAway(ev.target.checked)}/>
                            Tint what it takes away, over the source</label>}
                        <pre className="prep-notes">{preview.result.notes.join("\n")}</pre>
                    </>}
                </fieldset>
            </section>
        </div>
    </dialog>;
}

// What is asked of the server: without the parts that have nothing marked yet, which the model has nothing to go by.
function toSent(prep: SourcePrep): SourcePrep
{
    const cutOut = (prep.cutOut ?? []).filter(part => part.rect != undefined || (part.on?.length ?? 0) > 0);
    return JSON.parse(JSON.stringify({...prep, cutOut: (cutOut.length > 0) ? cutOut : undefined}));
}

function describePart(part: PrepCutOut): string
{
    const count = (points: [number, number][] | undefined, what: string) =>
        (points?.length ?? 0) > 0 ? `${points!.length} ${what}` : undefined;
    return [part.rect && "box", count(part.on, "on"), count(part.off, "off")].filter(text => text).join(", ")
        || "nothing marked yet";
}

interface Props
{
    // The source preprocessed, which stays as it is.
    source: SourceEntry;
    // What to start from: how a source made from this one was made, to make another.
    startPrep?: SourcePrep;
    onAdded: (added: SourceEntry) => void;
    onClose: () => void;
}
