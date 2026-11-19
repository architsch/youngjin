import FieldDomain from "../types/fieldDomain";
import FieldValueUtil from "../util/fieldValueUtil";
import ChoiceControl from "./choiceControl";
import ColorControl from "./colorControl";
import NumberControl from "./numberControl";
import ToggleControl from "./toggleControl";

// The control that suits what a field can hold. onPreview tries a value on without committing it (undefined
// ends the preview).
export default function FieldControl({ domain, value, allowIndeterminate, onChange, onPreview }: Props)
{
    if (domain.kind == "boolean")
        return <ToggleControl value={value === true} onChange={onChange} />;
    if (domain.kind == "number")
        return <NumberControl values={domain.values} value={value} onChange={onChange} />;
    if (FieldValueUtil.isColorDomain(domain))
    {
        return <ColorControl options={domain.options} value={value} allowIndeterminate={allowIndeterminate ?? false}
            onChange={onChange} onPreview={onPreview} />;
    }
    return <ChoiceControl options={domain.options} value={value} onChange={onChange} />;
}

interface Props
{
    domain: FieldDomain;
    value: any;
    allowIndeterminate?: boolean;
    onChange: (value: any) => void;
    onPreview: (value: any | undefined) => void;
}
