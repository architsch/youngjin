export default function CloseButton({ onClose }: Props)
{
    return <div
        className="absolute top-1 right-1 yj-text-sm yj-panel-gray cursor-pointer"
        onClick={onClose}
    >
        X
    </div>
}

interface Props
{
    onClose: () => void;
}
