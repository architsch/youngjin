export default function HeaderBar({ sourcePath, dirty, saving, errorCount, canUndo, canRedo, thumbnailSize,
    thumbnailSizes, onThumbnailSize, onUndo, onRedo, onRevert, onSave, onShowFirstError }: Props)
{
    let status = <span className="status-pill">Saved</span>;
    if (saving)
        status = <span className="status-pill">Saving…</span>;
    else if (dirty)
        status = <span className="status-pill unsaved">Unsaved changes</span>;

    return <header className="header-bar">
        <div className="brand">
            <span className="brand-title">Composition Editor</span>
            <span className="brand-file" title={sourcePath}>{sourcePath}</span>
        </div>
        <div className="header-status">
            {status}
            {errorCount > 0 && <button type="button" className="status-pill error" onClick={onShowFirstError}
                title="Select the first entry that fails to encode">
                {errorCount} {errorCount == 1 ? "entry fails" : "entries fail"} to encode
            </button>}
        </div>
        <div className="header-actions">
            <div className="segmented" role="group" aria-label="Thumbnail size">
                {thumbnailSizes.map(size => <button type="button" key={size}
                    className={size == thumbnailSize ? "selected" : ""} aria-pressed={size == thumbnailSize}
                    onClick={() => onThumbnailSize(size)} title={`Thumbnails at ${size} px`}>
                    {size}
                </button>)}
            </div>
            <button type="button" className="button" disabled={!canUndo} onClick={onUndo} title="Undo (⌘Z)">Undo</button>
            <button type="button" className="button" disabled={!canRedo} onClick={onRedo} title="Redo (⇧⌘Z)">Redo</button>
            <button type="button" className="button" disabled={!dirty} onClick={onRevert}
                title="Go back to the file on disk (undoable)">Revert</button>
            <button type="button" className="button primary" disabled={!dirty || saving} onClick={onSave}
                title="Write the file (⌘S)">Save</button>
        </div>
    </header>;
}

interface Props
{
    sourcePath: string;
    dirty: boolean;
    saving: boolean;
    errorCount: number;
    canUndo: boolean;
    canRedo: boolean;
    thumbnailSize: number;
    thumbnailSizes: number[];
    onThumbnailSize: (size: number) => void;
    onUndo: () => void;
    onRedo: () => void;
    onRevert: () => void;
    onSave: () => void;
    onShowFirstError: () => void;
}
