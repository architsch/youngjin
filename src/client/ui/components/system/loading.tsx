import { useEffect, useState } from "react";
import { ongoingProcessesObservable } from "../../../system/observables";
import { ongoingClientProcessExists } from "../../../system/types/clientProcess";
import ScreenCenterPopup from "../basic/screenCenterPopup";

export default function Loading()
{
    const [state, setState] = useState<LoadingState>({loading: false});

    useEffect(() => {
        ongoingProcessesObservable.addListener("ui.loading", _ => setState({loading: ongoingClientProcessExists()}));
        return () => {
            ongoingProcessesObservable.removeListener("ui.loading");
        };
    }, []);

    if (state.loading)
    {
        return <div className="w-full h-full z-900 bg-black/50">
            <ScreenCenterPopup text="Loading..." customClassNames="text-amber-600 text-4xl bg-black"/>
        </div>;
    }
    else
    {
        return null;
    }
}

interface LoadingState
{
    loading: boolean;
}