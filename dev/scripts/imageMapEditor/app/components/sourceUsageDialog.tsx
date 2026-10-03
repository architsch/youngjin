import { useEffect, useRef } from "react";
import ImageEntry from "../../core/imageEntry";
import SourceEntry from "../../core/sourceEntry";
import EntryCard from "./entryCard";

// The entries sampled from a source, as the Entries tab shows them; picking one opens it.
export default function SourceUsageDialog({ source, entries, imageVersion, openPath, onOpenEntry, onClose }: Props)
{
    const dialogRef = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (dialogRef.current?.open === false)
            dialogRef.current.showModal();
    }, []);

    return <dialog ref={dialogRef} className="usage-dialog" onClose={onClose}
        onClick={ev => {
            // Its contents fill it, so only a click on the backdrop lands on the dialog itself.
            if (ev.target == ev.currentTarget)
                dialogRef.current?.close();
        }}>
        <div className="panel-toolbar">
            <span className="panel-title source-name" title={source.fileName}>Entries sampled from {source.fileName}</span>
            <button type="button" className="button small" onClick={() => dialogRef.current?.close()}>Close</button>
        </div>
        <div className="entry-grid">
            {entries.map(entry => <EntryCard key={entry.path} entry={entry} imageVersion={imageVersion}
                selected={entry.path == openPath} onSelect={onOpenEntry}/>)}
        </div>
    </dialog>;
}

interface Props
{
    source: SourceEntry;
    entries: ImageEntry[];
    // See EditorApi.getGameImageURL.
    imageVersion: string;
    openPath: string | undefined;
    onOpenEntry: (path: string) => void;
    onClose: () => void;
}
