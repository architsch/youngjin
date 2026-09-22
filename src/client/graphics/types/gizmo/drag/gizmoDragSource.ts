import GizmoDragHandler from "./gizmoDragHandler";

// Something on screen a press can grab (see GizmoDragUtil). `pick` says what is under the pointer: the
// cursor hovering there shows, and how to begin the drag a press there starts; null when it's none of it.
export default interface GizmoDragSource
{
    pick: (ev: PointerEvent) => {cursor: string, begin: () => GizmoDragHandler} | null;
}
