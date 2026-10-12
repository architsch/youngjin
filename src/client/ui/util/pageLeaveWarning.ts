import { useEffect } from "react";

// While active, has the browser ask before the page is left: closed, reloaded or sent elsewhere. The wording is
// the browser's own, and it asks only a user who has touched the page.
export default function usePageLeaveWarning(active: boolean): void
{
    useEffect(() => {
        if (!active)
            return;
        window.addEventListener("beforeunload", askBeforeLeaving);
        return () => {
            window.removeEventListener("beforeunload", askBeforeLeaving);
        };
    }, [active]);
}

function askBeforeLeaving(ev: BeforeUnloadEvent): void
{
    ev.preventDefault();
    // What Chrome and Edge went by before version 119.
    ev.returnValue = true;
}
