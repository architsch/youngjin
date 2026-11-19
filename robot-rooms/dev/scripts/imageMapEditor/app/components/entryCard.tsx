import ImageEntry from "../../core/imageEntry";
import EditorApi from "../util/editorApi";

// An entry as the lists show it: its game image (dimmed and tagged when disabled, tagged when staging), number and
// title.
export default function EntryCard({ entry, imageVersion, selected, onSelect }: Props)
{
    const status = entry.disabled ? " (disabled: left out of the game)"
        : entry.staging ? " (staging: not offered on the live server)" : "";
    return <button type="button"
        title={`${entry.path}: ${entry.title}${status}`}
        className={`entry-card${selected ? " selected" : ""}${entry.disabled ? " disabled-entry" : ""}`}
        onClick={() => onSelect(entry.path)}>
        <div className="checkerboard entry-thumbnail">
            <img src={EditorApi.getGameImageURL(entry.path, imageVersion)} alt="" loading="lazy"/>
        </div>
        {entry.disabled && <span className="entry-tag">Disabled</span>}
        {entry.staging && <span className="entry-tag staging">Staging</span>}
        <span className="entry-caption">{entry.path.substring(entry.path.indexOf("/") + 1)}. {entry.title}</span>
    </button>;
}

interface Props
{
    entry: ImageEntry;
    // See EditorApi.getGameImageURL.
    imageVersion: string;
    selected: boolean;
    onSelect: (path: string) => void;
}
