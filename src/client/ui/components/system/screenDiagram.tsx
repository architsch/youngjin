import { useEffect, useState } from "react";
import { screenDiagramObservable } from "../../../system/clientObservables";
import DragUpDiagram from "../basic/diagrams/dragUpDiagram";

// A centered, semi-transparent panel that shows a vector-graphics diagram (one of the
// self-contained drawings under basic/diagrams) above a short caption. Used to demonstrate a
// gesture to the user — e.g. dragging upward to move. The overlay ignores pointer events so
// the user can still perform the demonstrated gesture "through" it.
export default function ScreenDiagram()
{
    const [content, setContent] = useState<{ diagram: "drag_up", text: string } | null>(null);

    useEffect(() => {
        screenDiagramObservable.addListener("ui.screenDiagram", setContent);
        // A tutorial step may set the diagram before this component mounts, and addListener
        // doesn't replay the current value, so sync to it explicitly on mount.
        setContent(screenDiagramObservable.peek());
        return () => screenDiagramObservable.removeListener("ui.screenDiagram");
    }, []);

    if (!content) return null;

    return <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-4 px-10 py-8 rounded-2xl bg-gray-900/80 border border-gray-600 shadow-xl">
            {content.diagram === "drag_up" && <DragUpDiagram additionalClassNames="w-32 h-56"/>}
            <div className="max-w-[14rem] text-center text-base font-semibold text-gray-100"
                dangerouslySetInnerHTML={{ __html: content.text }}/>
        </div>
    </div>;
}
