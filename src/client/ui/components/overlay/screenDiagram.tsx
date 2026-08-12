import { useEffect, useState } from "react";
import { screenDiagramObservable } from "../../../system/clientObservables";
import DragUpDiagram from "../../svg/diagrams/dragUpDiagram";
import DragSidewaysDiagram from "../../svg/diagrams/dragSidewaysDiagram";

// A semi-transparent panel that shows a vector-graphics diagram (one of the self-contained drawings
// under svg/diagrams) above a short caption. Used to demonstrate a gesture to the user — e.g.
// dragging upward to move. The overlay ignores pointer events so the user can still perform the
// demonstrated gesture "through" it.
//
// A gesture demonstrated for its own sake takes the middle of the screen, where it cannot be
// missed. One demonstrated so the user can watch what it does to something — turning the camera
// around his character — steps aside to the edge and is drawn small instead, since a panel in the
// way of the very thing the gesture is for defeats the lesson. The edge it steps to is the left one,
// clear of the headline above, of the way out of the mode opposite it, and of whatever panel the
// selection has put along the bottom.
export default function ScreenDiagram()
{
    const [content, setContent] = useState<
        { diagram: "drag_up" | "drag_sideways", text: string, placement: "center" | "side" } | null>(null);

    useEffect(() => {
        screenDiagramObservable.addListener("ui.screenDiagram", setContent);
        // A tutorial step may set the diagram before this component mounts, and addListener
        // doesn't replay the current value, so sync to it explicitly on mount.
        setContent(screenDiagramObservable.peek());
        return () => screenDiagramObservable.removeListener("ui.screenDiagram");
    }, []);

    if (!content) return null;

    const atSide = content.placement === "side";
    const panelClassNames = atSide
        ? "gap-2 px-4 py-3 rounded-xl"
        : "gap-4 px-10 py-8 rounded-2xl";
    const captionClassNames = atSide
        ? "max-w-[9rem] text-sm"
        : "max-w-[14rem] text-base";

    return <div className={`absolute inset-0 z-40 flex pointer-events-none ${atSide ? "items-center justify-start p-4" : "items-center justify-center"}`}>
        <div className={`flex flex-col items-center bg-gray-900/80 yj-surface-convex ${panelClassNames}`}>
            {content.diagram === "drag_up" &&
                <DragUpDiagram additionalClassNames={atSide ? "w-16 h-28" : "w-32 h-56"}/>}
            {content.diagram === "drag_sideways" &&
                <DragSidewaysDiagram additionalClassNames={atSide ? "w-28 h-17" : "w-56 h-34"}/>}
            <div className={`text-center font-semibold text-gray-100 ${captionClassNames}`}
                dangerouslySetInnerHTML={{ __html: content.text }}/>
        </div>
    </div>;
}
