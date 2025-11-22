import { useEffect, useState } from "react";
import { ongoingProcessesObservable } from "../../../system/observables";
import ClientProcess from "../../../system/types/clientProcess";

export default function Loading()
{
    const [state, setState] = useState<LoadingState>({loading: false});

    useEffect(() => {
        ongoingProcessesObservable.addListener("ui.loading", // subscribe
            (map: {[key: string]: ClientProcess}) => {
                let hasOngoingProcess = false;
                for (const clientProcess of Object.values(map))
                {
                    if (clientProcess.numOngoingProcesses > 0)
                        hasOngoingProcess = true;
                }
                setState({loading: hasOngoingProcess});
            });
        return () => {
            ongoingProcessesObservable.removeListener("ui.loading"); // unsubscribe
        };
    }, []);

    if (state.loading)
    {
        return <div className="loadingScreen">
            <div className="background"></div>
            <div className="content">Loading...</div>
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