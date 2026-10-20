import { useEffect } from "react";
import Loading from "./components/overlay/loading";
import Reconnecting from "./components/overlay/reconnecting";
import Watermark from "./components/overlay/watermark";

// The UI of an agent's camera page (see AgentCameraUtil): nothing over the room but the site's address in a corner and
// the waits, so that a screenshot is the view. "Loading..." gone is how an agent's browser tool knows the room is there.
export default function CameraUIRoot()
{
    // As UIRoot does, once this tree's own indicator is on screen.
    useEffect(() => {
        document.getElementById("bootLoadingIndicator")?.remove();
    }, []);

    return <>
        <Watermark/>
        <Loading/>
        <Reconnecting/>
    </>
}
