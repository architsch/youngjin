import { useEffect, useState } from "react";
import { ongoingProcessesObservable } from "../../../system/observables";
import { ongoingClientProcessExists } from "../../../system/types/clientProcess";

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

/*
.loadingScreen {
	${fullscreen_whole_area}
	${zero_spacing(landscape)}
	z-index: 900;

	.background {
		${fullscreen_whole_area}
		${zero_spacing(landscape)}
		${loading_screen_background_frame}
	}
	.content {
		position: absolute;
		min-width: 50%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		${xxl_bold_font}
		${xl_spacing(landscape)}
		${loading_screen_content_frame}
		text-align: center;
		z-index: 901;
	}
}
*/