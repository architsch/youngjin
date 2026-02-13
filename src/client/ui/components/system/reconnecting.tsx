import { useEffect, useState } from "react";
import { connectionStateObservable } from "../../../system/clientObservables";
import ScreenCenterText from "../basic/screenCenterText";

export default function Reconnecting()
{
    const [reconnecting, setReconnecting] = useState(false);

    useEffect(() => {
        connectionStateObservable.addListener("ui.reconnecting", (state: string) => {
            setReconnecting(state === "reconnecting");
        });
        return () => {
            connectionStateObservable.removeListener("ui.reconnecting");
        };
    }, []);

    return <>
        {reconnecting && <div className={className}>
            <ScreenCenterText text="Reconnecting..." customClassNames="text-amber-600 text-4xl bg-black"/>
        </div>}
    </>;
}

const className = "w-full h-full bg-black/50";
