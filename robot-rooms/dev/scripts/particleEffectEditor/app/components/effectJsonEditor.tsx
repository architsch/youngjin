import { useState } from "react";
import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";

// The effect as JSON, for anything the fields don't reach (removing an unknown field, pasting a layer).
// Applied whenever the text parses.
export default function EffectJsonEditor({ config, onEdit }: Props)
{
    const [draft, setDraft] = useState<string | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);

    return <details className="json-editor">
        <summary>Effect JSON</summary>
        <textarea className="textarea code" data-native-undo spellCheck={false} rows={16}
            value={draft ?? JSON.stringify(config, null, 4)}
            onChange={(event) => {
                setDraft(event.target.value);
                try
                {
                    const parsed = JSON.parse(event.target.value);
                    if (parsed == null || typeof parsed != "object" || Array.isArray(parsed))
                        throw new Error("An effect is a JSON object.");
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
    config: ParticleEffectConfig;
    onEdit: (update: (config: ParticleEffectConfig) => ParticleEffectConfig, coalesceKey?: string) => void;
}
