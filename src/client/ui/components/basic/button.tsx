export default function Button({name, size = "md", onClick }: ButtonProps)
{
    return <div
        className={classNames[size]}
        onClick={onClick}
    >
        {name}
    </div>
}

const classNames = {
    xs: "m-0.2 px-1 py-0.1 text-center text-xs text-gray-100 bg-gray-700 border-1 border-gray-500 pointer-events-auto",
    sm: "m-0.6 px-2 py-0.3 text-center text-sm text-gray-100 bg-gray-700 border-1 border-gray-500 pointer-events-auto",
    md: "m-1 px-3 py-0.5 text-center text-md font-semibold text-gray-100 bg-gray-700 border-2 border-gray-500 pointer-events-auto",
    lg: "m-1.4 px-4 py-0.7 text-center text-lg font-semibold text-gray-100 bg-gray-700 border-2 border-gray-500 pointer-events-auto",
};

interface ButtonProps
{
    name: string;
    size?: "xs" | "sm" | "md" | "lg";
    onClick: () => void;
}