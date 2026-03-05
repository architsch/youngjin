export default function Image({ src, size = "md", alt = "" }: Props)
{
    return <img
        className={`object-cover ${sizeClassNames[size]}`}
        src={src}
        alt={alt}
    />
}

const sizeClassNames = {
    sm: "w-16 h-16",
    md: "w-32 h-32",
    lg: "w-48 h-48",
};

interface Props
{
    src: string;
    size?: "sm" | "md" | "lg";
    alt?: string;
}
