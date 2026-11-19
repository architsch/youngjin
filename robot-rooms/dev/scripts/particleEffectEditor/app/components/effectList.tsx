import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";

// Every effect in the file, in its order.
export default function EffectList({ effects, selected, problemCounts, onSelect, onAdd }: Props)
{
    const names = Object.keys(effects);
    return <nav className="effect-list" aria-label="Effects">
        <div className="effect-list-header">
            <h2>Effects</h2>
            <span className="muted">{names.length}</span>
            <button type="button" className="button small" onClick={onAdd} title="A new effect, last in the file">New</button>
        </div>
        <ul>
            {names.map(name => <li key={name}>
                <button type="button" className={`effect-item${name == selected ? " selected" : ""}`} data-effect={name}
                    onClick={() => onSelect(name)}>
                    <span className="effect-item-top">
                        <span className="effect-name">{name}</span>
                        {(problemCounts[name] ?? 0) > 0 && <span className="problem-badge"
                            title={`${problemCounts[name]} ${problemCounts[name] == 1 ? "problem" : "problems"}`}>
                            {problemCounts[name]}
                        </span>}
                    </span>
                    {effects[name]?.note && <span className="effect-note">{effects[name].note}</span>}
                </button>
            </li>)}
        </ul>
    </nav>;
}

interface Props
{
    effects: {[effect: string]: ParticleEffectConfig};
    selected: string;
    problemCounts: {[effect: string]: number};
    onSelect: (name: string) => void;
    onAdd: () => void;
}
