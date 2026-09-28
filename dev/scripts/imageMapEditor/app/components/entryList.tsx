import EditorState from "../../core/editorState";
import EntryPathUtil from "../../core/entryPathUtil";
import EditorApi from "../util/editorApi";

// The map's entries, one tab per subfolder (disabled ones dimmed), and where a new one is started from an image on
// this machine (picked, or dropped anywhere on the list; it goes into the source library too).
export default function EntryList({ state, subfolder, selectedPath, onSelectSubfolder, onSelect, onOpenFile }: Props)
{
    const entries = state.entries.filter(entry => EntryPathUtil.getSubfolder(entry.path) == subfolder);
    return <div className="entry-list"
        onDragOver={ev => ev.preventDefault()}
        onDrop={ev => {
            ev.preventDefault();
            const file = ev.dataTransfer.files[0];
            if (file)
                onOpenFile(file);
        }}>
        <div className="segmented tabs">
            {state.subfolders.map(tab => <button key={tab.name} type="button"
                className={tab.name == subfolder ? "active" : ""} onClick={() => onSelectSubfolder(tab.name)}>
                {tab.title}</button>)}
        </div>
        <label className="button new-entry" title="Or drop an image here">
            New from an image…
            <input type="file" accept="image/*" hidden onChange={ev => {
                const file = ev.target.files?.[0];
                ev.target.value = "";
                if (file)
                    onOpenFile(file);
            }}/>
        </label>
        <div className="entry-grid">
            {entries.map(entry => <button key={entry.path} type="button"
                title={`${entry.path}: ${entry.title}${entry.disabled ? " (disabled: left out of the game)" : ""}`}
                className={`entry-card${entry.path == selectedPath ? " selected" : ""}${entry.disabled ? " disabled-entry" : ""}`}
                onClick={() => onSelect(entry.path)}>
                <div className="checkerboard entry-thumbnail">
                    <img src={EditorApi.getGameImageURL(entry.path, state.hash)} alt="" loading="lazy"/>
                </div>
                {entry.disabled && <span className="entry-tag">Disabled</span>}
                <span className="entry-caption">{entry.path.substring(entry.path.indexOf("/") + 1)}. {entry.title}</span>
            </button>)}
        </div>
    </div>;
}

interface Props
{
    state: EditorState;
    subfolder: string;
    selectedPath: string | undefined;
    onSelectSubfolder: (subfolder: string) => void;
    onSelect: (path: string) => void;
    onOpenFile: (file: File) => void;
}
