export default function Text({content, size = "md", color = "gray" }: Props)
{
    return <div className={`text-left ${textClassNames[size]} ${panelClassNames[color]}`}>
        {content}
    </div>
}

const textClassNames = {
    xs: "yj-text-xs",
    sm: "yj-text-sm",
    md: "yj-text-md",
    lg: "yj-text-lg",
};

const panelClassNames = {
    gray: "text-gray-300",
    green: "text-green-300",
    red: "text-pink-300",
};

interface Props
{
    content: string;
    size?: "xs" | "sm" | "md" | "lg";
    color?: "gray" | "green" | "red";
}