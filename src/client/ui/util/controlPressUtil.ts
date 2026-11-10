import { controlPressedObservable } from "../../system/clientObservables";

// Tells of every press of one of the UI's controls (see controlPressedObservable), by the one thing they all share: the
// hand the pointer turns into over them (cursor-pointer), which no disabled control and nothing that can't be clicked
// shows.
const ControlPressUtil =
{
    // After ScreenInputBlockUtil, so that a click it holds is no press.
    install: (): void =>
    {
        window.addEventListener("click", onClick, true);
    },
}

function onClick(event: MouseEvent): void
{
    const control = (event.target instanceof Element) ? event.target.closest(".cursor-pointer") : null;
    if (control != null)
        controlPressedObservable.set(control.id);
}

export default ControlPressUtil;
