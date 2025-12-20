export default function Button(props: {name: string, onClick: () => void})
{
    return <div
        className="m-1 px-3 py-0.5 text-center text-md font-semibold text-gray-100 bg-gray-700 border-2 border-gray-500"
        onClick={props.onClick}
    >
        {props.name}
    </div>
}