export default function Button({name, size = "md", color = "gray", disabled = false, onClick }: Props)
{
    return <div
        className={`text-center ${textClassNames[size]} ${disabled ? panelClassNames["disabled"] : panelClassNames[color]}`}
        onClick={disabled ? undefined : onClick}
    >
        {name}
    </div>
}

const textClassNames = {
    xs: "yj-text-xs",
    sm: "yj-text-sm",
    md: "yj-text-md",
    lg: "yj-text-lg",
};

const panelClassNames = {
    gray: "yj-panel-gray",
    green: "yj-panel-green",
    red: "yj-panel-red",
    disabled: "yj-panel-gray opacity-50 cursor-not-allowed",
};

interface Props
{
    name: string;
    size?: "xs" | "sm" | "md" | "lg";
    color?: "gray" | "green" | "red";
    disabled?: boolean;
    onClick: () => void;
}