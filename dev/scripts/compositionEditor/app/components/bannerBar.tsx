import EditorBanner from "../types/editorBanner";

export default function BannerBar({ banner, onLoadDiskVersion, onKeepMine, onOverwrite, onDismiss }: Props)
{
    if (banner.kind == "error")
    {
        return <div className="banner error" role="alert">
            <span className="banner-message">{banner.message}</span>
            <div className="banner-actions">
                <button type="button" className="button small" onClick={onDismiss}>Dismiss</button>
            </div>
        </div>;
    }

    const message = (banner.kind == "external")
        ? "The file changed on disk, and this editor has unsaved changes."
        : "Not saved: the file changed on disk since the editor last read it.";
    return <div className="banner warning" role="alert">
        <span className="banner-message">{message}</span>
        <div className="banner-actions">
            <button type="button" className="button small" onClick={onLoadDiskVersion}
                title="Replace the editor's version with the file's (undoable)">Load the file's version</button>
            {banner.kind == "external"
                ? <button type="button" className="button small" onClick={onKeepMine}
                    title="Keep editing; the next save replaces the file">Keep mine</button>
                : <button type="button" className="button small danger" onClick={onOverwrite}
                    title="Replace the file with the editor's version">Overwrite the file</button>}
        </div>
    </div>;
}

interface Props
{
    banner: EditorBanner;
    onLoadDiskVersion: () => void;
    onKeepMine: () => void;
    onOverwrite: () => void;
    onDismiss: () => void;
}
