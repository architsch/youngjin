// One of a few named options, all in view.
export default function ChoiceControl({ options, value, labels, onChange }: Props)
{
    return <div className="choice-control">
        <div className="segmented" role="group">
            {options.map(option => <button type="button" key={option} className={option == value ? "selected" : ""}
                aria-pressed={option == value} onClick={() => onChange(option)}>
                {labels?.[option] ?? option}
            </button>)}
        </div>
        {!options.includes(value) && <span className="field-hint">{JSON.stringify(value)} is none of these</span>}
    </div>;
}

interface Props
{
    options: string[];
    value: string;
    labels?: {[option: string]: string};
    onChange: (value: string) => void;
}
