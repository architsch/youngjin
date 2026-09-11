//------------------------------------------------------------------------
// The panels on screen that the user can put away, newest last.
//
// The back gesture (Escape, or the device's Back) puts away whatever is on top before it does
// anything else. For popups that is easy to know, since there is a single stack of them held by the
// UI root. Panels are not like that: each one is raised by whatever it belongs to, from wherever in
// the tree that happens to be — a door's colours from the door's own tools, a room's settings from
// the top bar — so each one enters itself here for as long as it is up, and the back gesture asks
// here what there is to put away (see UIRoot).
//
// One gesture puts away one panel, the newest, as it does with popups: a panel raised from inside
// another is the one the user is looking at, and taking both at once would take the one he had not
// finished with.
//------------------------------------------------------------------------

// Each entry is the panel's own way of putting itself away. Taking it off the list is the panel's
// business rather than this module's, done as it leaves the screen — which a request to close
// normally leads to, but only the panel can say whether it did.
const openPanels: {token: number, close: () => void}[] = [];
let nextToken = 0;

const ClosablePanelUtil =
{
    // Enters a panel on the list, returning the token it is to be taken off again by.
    register: (close: () => void): number =>
    {
        const token = nextToken++;
        openPanels.push({token, close});
        return token;
    },
    unregister: (token: number): void =>
    {
        const index = openPanels.findIndex(entry => entry.token == token);
        if (index >= 0)
            openPanels.splice(index, 1);
    },
    hasOpenPanel: (): boolean =>
    {
        return openPanels.length > 0;
    },
    // Asks the newest panel to put itself away.
    closeTopmost: (): void =>
    {
        openPanels[openPanels.length - 1]?.close();
    },
}

export default ClosablePanelUtil;
