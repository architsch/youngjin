export default function Image({ src, size = "md", aspectRatio = 1, alt = "", additionalClassNames = "" }: Props)
{
    // The ratio is inline, since it is dynamic and Tailwind can't generate it.
    return <img
        className={`object-cover ${widthClassNames[size]} ${additionalClassNames}`}
        style={{ aspectRatio }}
        src={src}
        alt={alt}
    />
}

const widthClassNames = {
    sm: "w-16",
    md: "w-32",
    lg: "w-48",
};

interface Props
{
    src: string;
    size?: "sm" | "md" | "lg";
    aspectRatio?: number; // width over height
    alt?: string;
    additionalClassNames?: string;
}
