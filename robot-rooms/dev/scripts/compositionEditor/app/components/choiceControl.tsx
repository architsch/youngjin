import FieldValueUtil from "../util/fieldValueUtil";

export default function ChoiceControl({ options, value, onChange }: Props)
{
    const index = FieldValueUtil.findOption(options, value);
    return <select className="select" value={index}
        onChange={(event) => onChange(options[Number(event.target.value)])}>
        {index < 0 && <option value={-1}>{FieldValueUtil.getChoiceLabel(value)} (can't be stored)</option>}
        {options.map((option, i) => <option key={i} value={i}>{FieldValueUtil.getChoiceLabel(option)}</option>)}
    </select>;
}

interface Props
{
    options: any[];
    value: any;
    onChange: (value: any) => void;
}
