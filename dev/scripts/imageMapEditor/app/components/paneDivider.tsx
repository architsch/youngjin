import { useRef } from "react";

// How far an arrow key moves the divider, as a share of the column.
const KEY_STEP = 0.02;

// The bar between two panels stacked in a column, dragged up and down (or moved with the arrow keys) to share the
// column's height between them: it reports the share above it, kept within min and max.
export default function PaneDivider(props: {share: number, min: number, max: number, title: string,
    onChange: (share: number) => void})
{
    // Where on the bar the drag took hold, so the bar doesn't jump to put its top edge under the pointer.
    const grabOffsetRef = useRef(0);
    const clamp = (share: number) => Math.min(props.max, Math.max(props.min, share));

    return <div className="pane-divider" role="separator" aria-orientation="horizontal" tabIndex={0} title={props.title}
        aria-valuemin={Math.round(props.min * 100)} aria-valuemax={Math.round(props.max * 100)}
        aria-valuenow={Math.round(props.share * 100)}
        onPointerDown={ev => {
            ev.preventDefault();
            grabOffsetRef.current = ev.clientY - ev.currentTarget.getBoundingClientRect().top;
            ev.currentTarget.setPointerCapture(ev.pointerId);
        }}
        onPointerMove={ev => {
            if (!ev.currentTarget.hasPointerCapture(ev.pointerId))
                return;
            const column = ev.currentTarget.parentElement!.getBoundingClientRect();
            props.onChange(clamp((ev.clientY - grabOffsetRef.current - column.top) / column.height));
        }}
        onKeyDown={ev => {
            const step = (ev.key == "ArrowUp") ? -KEY_STEP : (ev.key == "ArrowDown") ? KEY_STEP : 0;
            if (step == 0)
                return;
            ev.preventDefault();
            props.onChange(clamp(props.share + step));
        }}/>;
}
