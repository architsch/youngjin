import { useEffect, useRef, useState } from "react";
import ImageRecipe from "../../core/imageRecipe";
import LoadedSource from "../types/loadedSource";
import PreviewMessage from "../types/previewMessage";
import PreviewResult from "../types/previewResult";
import EditorApi from "../util/editorApi";

// The previews rerun at every edit, so they are made from the source's small copy, and no larger than this.
const PREVIEW_SAMPLE_SIDE = 512;

// A draft's previews, rendered in a worker (see previewWorker.ts): the newest finished render of this source,
// shown while the next is under way, so the page never waits on one. Given a detail size, it renders only the
// sample, that large, from the full-size source the worker fetches itself (the magnified view's).
export default function usePreview(source: LoadedSource | undefined, recipe: ImageRecipe | undefined,
    showRemoved: boolean, cellSize: number, detailSide?: number): PreviewResult | undefined
{
    const workerRef = useRef<Worker | null>(null);
    const nextIdRef = useRef(0);
    const [result, setResult] = useState<PreviewResult>();
    const detailed = detailSide != undefined;

    useEffect(() => {
        const worker = new Worker("/preview-worker.js");
        worker.onmessage = (event: MessageEvent<PreviewResult>) => setResult(event.data);
        workerRef.current = worker;
        return () => worker.terminate();
    }, []);

    useEffect(() => {
        if (source == undefined)
            return;
        if (detailed)
        {
            post(workerRef.current, {kind: "sourceUrl", sha1: source.sha1, url: EditorApi.getSourceURL(source.sha1)});
            return;
        }
        // A copy, since the page keeps its own.
        const copy = {...source.preview, data: new Uint8ClampedArray(source.preview.data)};
        post(workerRef.current, {kind: "source", sha1: source.sha1, source: copy}, [copy.data.buffer]);
    }, [source, detailed]);

    useEffect(() => {
        if (source == undefined || recipe == undefined)
            return;
        post(workerRef.current, {kind: "render", id: ++nextIdRef.current, sha1: source.sha1, recipe,
            maxSide: detailSide ?? PREVIEW_SAMPLE_SIDE, cellSize, showRemoved, withGameImage: !detailed});
    }, [source, recipe, showRemoved, cellSize, detailSide, detailed]);

    return (result != undefined && result.sha1 == source?.sha1) ? result : undefined;
}

function post(worker: Worker | null, message: PreviewMessage, transfer: Transferable[] = []): void
{
    worker?.postMessage(message, transfer);
}
