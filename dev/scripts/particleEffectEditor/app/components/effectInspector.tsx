import { useEffect, useState } from "react";
import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";
import ParticleLayerConfig from "../../../../../src/client/graphics/particle/types/particleLayerConfig";
import EffectSourceUtil from "../util/effectSourceUtil";
import EffectJsonEditor from "./effectJsonEditor";
import LayerCard from "./layerCard";

// The selected effect: its name (how the game plays it), a note on what it is for, and its layers.
export default function EffectInspector({ name, config, effects, problems, onRename, onEdit, onDuplicate,
    onDelete }: Props)
{
    const [nameDraft, setNameDraft] = useState(name);
    const [collapsed, setCollapsed] = useState<boolean[]>([]);
    useEffect(() => {
        setNameDraft(name);
    }, [name]);

    const layers: ParticleLayerConfig[] = Array.isArray(config.layers) ? config.layers : [];
    const nameProblem = (nameDraft != name) ? EffectSourceUtil.getNameProblem(effects, nameDraft, name) : undefined;
    const effectProblems = problems.filter(problem => !problem.startsWith("Layer "));

    const commitName = () => {
        if (nameDraft == name || nameProblem != undefined || !onRename(nameDraft))
            setNameDraft(name);
    };
    const editLayers = (update: (layers: ParticleLayerConfig[]) => ParticleLayerConfig[], coalesceKey?: string) =>
        onEdit(current => ({...current, layers: update(Array.isArray(current.layers) ? current.layers : [])}),
            coalesceKey);
    const editLayer = (index: number) =>
        (update: (layer: ParticleLayerConfig) => ParticleLayerConfig, coalesceKey?: string) =>
            editLayers(current => current.map((layer, i) => (i == index) ? update(layer) : layer),
                coalesceKey && `layer${index}.${coalesceKey}`);
    const moveLayer = (index: number, direction: -1 | 1) => {
        editLayers(current => {
            const moved = [...current];
            [moved[index], moved[index + direction]] = [moved[index + direction], moved[index]];
            return moved;
        });
        setCollapsed(current => {
            const moved = [...current];
            [moved[index], moved[index + direction]] = [moved[index + direction], moved[index]];
            return moved;
        });
    };
    const duplicateLayer = (index: number) => {
        editLayers(current => [...current.slice(0, index + 1), EffectSourceUtil.copy(current[index]),
            ...current.slice(index + 1)]);
        setCollapsed(current => [...current.slice(0, index + 1), false, ...current.slice(index + 1)]);
    };
    const deleteLayer = (index: number) => {
        editLayers(current => current.filter((_, i) => i != index));
        setCollapsed(current => current.filter((_, i) => i != index));
    };

    return <div className="inspector-body">
        <div className="inspector-header">
            <input className={`name-input${nameProblem != undefined ? " invalid" : ""}`} value={nameDraft}
                spellCheck={false} aria-label="Effect name" data-native-undo
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                    if (event.key == "Enter")
                        commitName();
                    else if (event.key == "Escape")
                        setNameDraft(name);
                }} />
            <div className="inspector-actions">
                <button type="button" className="button small" onClick={onDuplicate}>Duplicate</button>
                <button type="button" className="button small danger" onClick={onDelete}>Delete</button>
            </div>
        </div>
        {nameProblem != undefined && <p className="field-error">{nameProblem}</p>}
        <textarea className="textarea note" rows={2} placeholder="What the effect is for" data-native-undo
            value={config.note ?? ""}
            onChange={(event) => onEdit(current => ({...current, note: event.target.value || undefined}), "note")} />
        {effectProblems.length > 0 && <div className="notice error"><ul>
            {effectProblems.map(problem => <li key={problem}>{problem}</li>)}
        </ul></div>}
        {layers.map((layer, i) => <LayerCard key={i}
            layer={layer}
            index={i}
            count={layers.length}
            problems={problems.filter(problem => problem.startsWith(`Layer ${i + 1}: `))
                .map(problem => problem.slice(`Layer ${i + 1}: `.length))}
            collapsed={collapsed[i] ?? false}
            onToggleCollapsed={() => setCollapsed(current => {
                const next = [...current];
                next[i] = !(current[i] ?? false);
                return next;
            })}
            onEdit={editLayer(i)}
            onMove={(direction) => moveLayer(i, direction)}
            onDuplicate={() => duplicateLayer(i)}
            onDelete={() => deleteLayer(i)} />)}
        <div className="inspector-footer">
            <button type="button" className="button" onClick={() => editLayers(current =>
                [...current, EffectSourceUtil.createLayer()])}>Add layer</button>
        </div>
        <EffectJsonEditor config={config} onEdit={onEdit} />
    </div>;
}

interface Props
{
    name: string;
    config: ParticleEffectConfig;
    effects: {[effect: string]: ParticleEffectConfig};
    problems: string[];
    onRename: (name: string) => boolean; // false if it was called off
    onEdit: (update: (config: ParticleEffectConfig) => ParticleEffectConfig, coalesceKey?: string) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}
