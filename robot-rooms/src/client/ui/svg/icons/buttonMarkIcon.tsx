import { ButtonMark } from "../../types/buttonMark";

export default function ButtonMarkIcon({mark}: {mark: ButtonMark})
{
    return <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        {(mark == "add") ? <path d="M5 1v8M1 5h8"/> : <polyline points="1 7 5 3 9 7"/>}
    </svg>
}
