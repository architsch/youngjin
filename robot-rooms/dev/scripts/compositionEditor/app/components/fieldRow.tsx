import { ReactNode } from "react";

// A labelled field. A params field the entry leaves out shows the codec's default, dimmed; onReset (for
// one it sets) leaves it out again.
export default function FieldRow({ label, isDefault, isUnknown, onReset, children }: Props)
{
    const className = `field-row${isDefault ? " is-default" : ""}${isUnknown ? " is-unknown" : ""}`;
    return <div className={className}>
        <div className="field-label" title={label}>
            <span className="field-label-text">{label}</span>
            {isDefault && <span className="field-tag">default</span>}
            {isUnknown && <span className="field-tag">unknown field</span>}
        </div>
        <div className="field-control">{children}</div>
        {onReset != undefined
            ? <button type="button" className="icon-button" onClick={onReset}
                title="Leave this field out of the entry (the codec's default applies)" aria-label="Leave out">×</button>
            : <span className="icon-spacer" />}
    </div>;
}

interface Props
{
    label: string;
    isDefault?: boolean;
    isUnknown?: boolean;
    onReset?: () => void;
    children: ReactNode;
}
