import EditorState from "../../core/editorState";
import EntryPathUtil from "../../core/entryPathUtil";
import EntryCard from "./entryCard";
import PictureSearchUtil from "../../../../../src/shared/graphics/image/util/pictureSearchUtil";

// The map's entries, one tab per subfolder (disabled ones dimmed), and where a new one is started from an image on
// this machine (picked, or dropped anywhere on the list; it goes into the source library too). A search of their
// titles, authors and keywords (see PictureSearchUtil) narrows them, each tab then counting what it finds.
export default function EntryList({ state, subfolder, selectedPath, search, onSelectSubfolder, onSearchChange,
    onSelect, onOpenFile }: Props)
{
    const found = PictureSearchUtil.filter(state.entries, search,
        entry => `${entry.title},${entry.author},${entry.keywords ?? ""}`);
    const inTab = (tab: string) => found.filter(entry => EntryPathUtil.getSubfolder(entry.path) == tab);
    const entries = inTab(subfolder);
    const searching = search.trim().length > 0;
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
                {tab.title}{searching && ` (${inTab(tab.name).length})`}</button>)}
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
        <input type="search" className="entry-search" value={search} placeholder="Search by title, author or keyword"
            onChange={ev => onSearchChange(ev.target.value)}/>
        {searching && entries.length == 0 && <div className="panel-note">No entry in this tab matches the search.</div>}
        <div className="entry-grid">
            {entries.map(entry => <EntryCard key={entry.path} entry={entry} imageVersion={state.hash}
                selected={entry.path == selectedPath} onSelect={onSelect}/>)}
        </div>
    </div>;
}

interface Props
{
    state: EditorState;
    subfolder: string;
    selectedPath: string | undefined;
    // Kept by the app, so it lasts while the Sources tab is shown.
    search: string;
    onSelectSubfolder: (subfolder: string) => void;
    onSearchChange: (search: string) => void;
    onSelect: (path: string) => void;
    onOpenFile: (file: File) => void;
}
