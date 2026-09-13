import { useEffect, useState } from "react";
import { ongoingClientProcessesObservable } from "../../../system/clientObservables";
import { ongoingClientProcessExists } from "../../../system/types/clientProcess";
import RoomLoadProgressUtil from "../../../system/util/roomLoadProgressUtil";
import ProgressBar from "../basic/progressBar";
import ScreenCenterText from "./screenCenterText";

export default function Loading()
{
    const [state, setState] = useState<LoadingState>({loading: ongoingClientProcessExists()});
    // Room load progress, or null for waits that aren't room loads (e.g. reconnection).
    const [progress, setProgress] = useState<number | null>(null);

    useEffect(() => {
        ongoingClientProcessesObservable.addListener("ui.loading", _ => setState({
            loading: ongoingClientProcessExists()
        }));
        return () => {
            ongoingClientProcessesObservable.removeListener("ui.loading");
        };
    }, []);

    // Sampled per frame (the estimate advances with time); negligible changes are skipped.
    useEffect(() => {
        if (!state.loading)
            return;
        let animationFrameId = 0;
        const sampleProgress = () => {
            const sampledProgress = RoomLoadProgressUtil.getProgress();
            setProgress(prevProgress => isVisiblyDifferent(prevProgress, sampledProgress)
                ? sampledProgress : prevProgress);
            animationFrameId = requestAnimationFrame(sampleProgress);
        };
        animationFrameId = requestAnimationFrame(sampleProgress);
        return () => cancelAnimationFrame(animationFrameId);
    }, [state.loading]);

    return <>
        {state.loading && <div className={className}>
            <ScreenCenterText text="Loading..." customClassNames="text-amber-600 bg-black">
                {progress != null && <ProgressBar value={progress}
                    additionalClassNames="mt-[clamp(0.5rem,2vw,1.25rem)]"/>}
            </ScreenCenterText>
        </div>}
    </>;
}

// Below this, a change isn't visible on the bar.
const smallestVisibleProgressChange = 0.001;

function isVisiblyDifferent(prevProgress: number | null, newProgress: number | null): boolean
{
    if (prevProgress == null || newProgress == null)
        return prevProgress != newProgress;
    return Math.abs(newProgress - prevProgress) >= smallestVisibleProgressChange;
}

const className = "absolute inset-0 z-50 pointer-events-auto bg-black/50";

interface LoadingState
{
    loading: boolean;
}
