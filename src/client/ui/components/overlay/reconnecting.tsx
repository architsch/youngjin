import { useEffect, useState } from "react";
import { connectionStateObservable } from "../../../system/clientObservables";
import ScreenCenterText from "./screenCenterText";

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
            <ScreenCenterText text="Reconnecting..." customClassNames="text-amber-600 bg-black"/>
        </div>}
    </>;
}

const className = "absolute inset-0 z-50 pointer-events-auto bg-black/50";
