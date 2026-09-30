export default function HeaderBar({ sourcePath, dirty, saving, problemCount, canUndo, canRedo, onUndo, onRedo,
    onRevert, onSave, onShowFirstProblem }: Props)
{
    let status = <span className="status-pill">Saved</span>;
    if (saving)
        status = <span className="status-pill">Saving…</span>;
    else if (dirty)
        status = <span className="status-pill unsaved">Unsaved changes</span>;

    return <header className="header-bar">
        <div className="brand">
            <span className="brand-title">Particle Effect Editor</span>
            <span className="brand-file" title={sourcePath}>{sourcePath}</span>
        </div>
        <div className="header-status">
            {status}
            {problemCount > 0 && <button type="button" className="status-pill error" onClick={onShowFirstProblem}
                title="Select the first effect with problems">
                {problemCount} {problemCount == 1 ? "effect has" : "effects have"} problems
            </button>}
        </div>
        <div className="header-actions">
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
    problemCount: number;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onRevert: () => void;
    onSave: () => void;
    onShowFirstProblem: () => void;
}
