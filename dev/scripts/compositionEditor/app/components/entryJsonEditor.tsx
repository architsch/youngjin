import { useState } from "react";
import PreEncodingSourceEntry from "../../../../../src/shared/graphics/mesh/composition/types/preEncodingSourceEntry";

// The entry as JSON, for anything the fields above don't reach. Applied whenever the text parses.
export default function EntryJsonEditor({ entry, onEdit }: Props)
{
    const [draft, setDraft] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

    return <details className="json-editor">
        <summary>Entry JSON</summary>
        <textarea className="textarea code" data-native-undo spellCheck={false} rows={14}
            value={draft ?? JSON.stringify(entry, null, 4)}
            onChange={(event) => {
                setDraft(event.target.value);
                try
                {
                    const parsed = JSON.parse(event.target.value);
                    if (parsed == null || typeof parsed != "object" || Array.isArray(parsed))
                        throw new Error("An entry is a JSON object.");
                    setParseError(null);
                    onEdit(() => parsed, "json");
                }
                catch (err)
                {
                    setParseError(err instanceof Error ? err.message : String(err));
                }
            }}
            onBlur={() => {
                setDraft(null);
                setParseError(null);
            }} />
        {parseError != null && <p className="field-error">Not applied: {parseError}</p>}
    </details>;
}

interface Props
{
    entry: PreEncodingSourceEntry;
    onEdit: (update: (entry: PreEncodingSourceEntry) => PreEncodingSourceEntry, coalesceKey?: string) => void;
}
