const baseClassNames = "absolute top-0 bottom-0 left-0 right-0 m-auto p-10 w-fit h-fit rounded-4xl text-center pointer-events-none";

export default function ScreenCenterPopup(props: {text: string, customClassNames: string})
{
    return <div className={`${baseClassNames} ${props.customClassNames}`}>
        {props.text}
    </div>;
}