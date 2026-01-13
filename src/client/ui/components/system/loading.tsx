import { useEffect, useState } from "react";
import { ongoingClientProcessesObservable } from "../../../system/clientObservables";
import { ongoingClientProcessExists } from "../../../system/types/clientProcess";
import ScreenCenterText from "../basic/screenCenterText";
import { Z_INDEX_LOADING_SCREEN } from "../../../../shared/system/constants";

export default function Loading()
{
    const [state, setState] = useState<LoadingState>({loading: true});

    useEffect(() => {
        ongoingClientProcessesObservable.addListener("ui.loading", _ => setState({
            loading: ongoingClientProcessExists()
        }));
        return () => {
            ongoingClientProcessesObservable.removeListener("ui.loading");
        };
    }, []);

    return <>
        {state.loading && <div className={className}>
            <ScreenCenterText text="Loading..." customClassNames="text-amber-600 text-4xl bg-black"/>
        </div>}
    </>;
}

const className = `w-full h-full bg-black/50 ${Z_INDEX_LOADING_SCREEN}`;

interface LoadingState
{
    loading: boolean;
}