export default function Spacer({ size = "md" }: Props)
{
    return <div className={sizeClassNames[size]}></div>
}

const sizeClassNames = {
    xs: "w-1 h-1",
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
};

interface Props
{
    size?: "xs" | "sm" | "md" | "lg";
}