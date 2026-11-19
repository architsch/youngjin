import ParticleLayerConfig from "../../../../../src/client/graphics/particle/types/particleLayerConfig";
import LayerFieldSpecMap from "../maps/layerFieldSpecMap";
import LayerField from "./layerField";
import SpriteThumbnail from "./spriteThumbnail";

// One layer of the effect: a stream of particles with its own sprite, emission and motion.
export default function LayerCard({ layer, index, count, problems, collapsed, onToggleCollapsed, onEdit, onMove,
    onDuplicate, onDelete }: Props)
{
    return <section className="layer-card">
        <header className="layer-header">
            <button type="button" className="layer-toggle" onClick={onToggleCollapsed} aria-expanded={!collapsed}>
                <span className="chevron" aria-hidden="true">{collapsed ? "▸" : "▾"}</span>
                <span className="layer-thumb"><SpriteThumbnail sprite={String(layer.sprite)} size={26} /></span>
                <span className="layer-title">Layer {index + 1}</span>
                <span className="layer-summary">{summarize(layer)}</span>
            </button>
            <div className="layer-actions">
                <button type="button" className="icon-button" disabled={index == 0} onClick={() => onMove(-1)}
                    title="Move up (a later layer's burst draws over an earlier one's)" aria-label="Move up">↑</button>
                <button type="button" className="icon-button" disabled={index == count - 1} onClick={() => onMove(1)}
                    title="Move down" aria-label="Move down">↓</button>
                <button type="button" className="icon-button" onClick={onDuplicate} title="Duplicate"
                    aria-label="Duplicate">⧉</button>
                <button type="button" className="icon-button danger" disabled={count <= 1} onClick={onDelete}
                    title={count <= 1 ? "An effect keeps at least one layer" : "Delete"} aria-label="Delete">✕</button>
            </div>
        </header>
        {problems.length > 0 && <div className="notice error"><ul>
            {problems.map(problem => <li key={problem}>{problem}</li>)}
        </ul></div>}
        {!collapsed && <div className="layer-body">
            {LayerFieldSpecMap.getSections().map(section => <div className="layer-section" key={section.title}>
                <h4>{section.title}</h4>
                <div className="field-list">
                    {section.fields.map(field => <LayerField key={field} layer={layer} field={field} onEdit={onEdit} />)}
                </div>
            </div>)}
        </div>}
    </section>;
}

// What it emits and for how long, at a glance.
function summarize(layer: ParticleLayerConfig): string
{
    const parts = [String(layer.sprite)];
    if ((layer.burst ?? 0) > 0)
        parts.push(`burst ${layer.burst}`);
    if ((layer.rate ?? 0) > 0)
        parts.push(`${layer.rate}/s`);
    if (Array.isArray(layer.lifetime))
        parts.push(`${layer.lifetime[0]}–${layer.lifetime[1]} s`);
    return parts.join(" · ");
}

interface Props
{
    layer: ParticleLayerConfig;
    index: number;
    count: number;
    problems: string[];
    collapsed: boolean;
    onToggleCollapsed: () => void;
    onEdit: (update: (layer: ParticleLayerConfig) => ParticleLayerConfig, coalesceKey?: string) => void;
    onMove: (direction: -1 | 1) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}
