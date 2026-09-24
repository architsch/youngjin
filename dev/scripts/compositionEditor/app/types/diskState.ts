// The source file as last read or written by the editor.
export default interface DiskState
{
    text: string;
    hash: string;
    // As the editor would write it, so formatting alone never counts as an unsaved change.
    normalized: string;
}
