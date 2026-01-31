export default function Button({name, size = "md", color = "gray", onClick }: Props)
{
    return <div
        className={`text-center ${textClassNames[size]} ${panelClassNames[color]}`}
        onClick={onClick}
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
};

interface Props
{
    name: string;
    size?: "xs" | "sm" | "md" | "lg";
    color?: "gray" | "green" | "red";
    onClick: () => void;
}