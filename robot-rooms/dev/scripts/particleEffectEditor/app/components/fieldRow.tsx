import { ReactNode } from "react";

// A labelled field, its hint on the label. A field the layer leaves out shows its default, dimmed; onReset
// (for one it sets) leaves it out again.
export default function FieldRow({ label, hint, isDefault, onReset, children }: Props)
{
    return <div className={`field-row${isDefault ? " is-default" : ""}`}>
        <div className="field-label" title={hint}>
            <span className="field-label-text">{label}</span>
            {isDefault && <span className="field-tag">default</span>}
        </div>
        <div className="field-control">{children}</div>
        {onReset != undefined
            ? <button type="button" className="icon-button" onClick={onReset}
                title="Leave this field out (its default applies)" aria-label="Leave out">×</button>
            : <span className="icon-spacer" />}
    </div>;
}

interface Props
{
    label: string;
    hint: string;
    isDefault?: boolean;
    onReset?: () => void;
    children: ReactNode;
}
