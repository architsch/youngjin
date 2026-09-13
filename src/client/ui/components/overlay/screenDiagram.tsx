import { useEffect, useState } from "react";
import { screenDiagramObservable } from "../../../system/clientObservables";
import DragUpDiagram from "../../svg/diagrams/dragUpDiagram";
import DragSidewaysDiagram from "../../svg/diagrams/dragSidewaysDiagram";

// Gesture diagram (svg/diagrams) with a caption, ignoring pointer events so the gesture can be done
// through it. Centred by default; "edge" placement draws it small at the left edge when the user must
// watch the gesture's effect.
export default function ScreenDiagram()
{
    const [content, setContent] = useState<
        { diagram: "drag_up" | "drag_sideways", text: string, placement: "center" | "side" } | null>(null);

    useEffect(() => {
        screenDiagramObservable.addListener("ui.screenDiagram", setContent);
        // May be set before mount, and addListener doesn't replay, so sync now.
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
