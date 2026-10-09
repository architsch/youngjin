// Stack of open closable panels (newest last). Panels register themselves from anywhere in the tree;
// the back gesture closes the newest one per gesture (see UIRoot).

// Each entry's close callback, and whether its panel stands over the selection tools. Panels remove their own
// entry when they unmount.
const openPanels: {token: number, close: () => void, overTools: boolean}[] = [];
let nextToken = 0;

const ClosablePanelUtil =
{
    // Enters a panel on the list, returning the token it is to be taken off again by. overTools: false for one
    // that leaves the selection tools on screen, which then keep their shortcut key (see useShortcutKeyListener).
    register: (close: () => void, overTools: boolean = true): number =>
    {
        const token = nextToken++;
        openPanels.push({token, close, overTools});
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
    hasPanelOverTools: (): boolean =>
    {
        return openPanels.some(entry => entry.overTools);
    },
    // Asks the newest panel to put itself away.
    closeTopmost: (): void =>
    {
        openPanels[openPanels.length - 1]?.close();
    },
}

export default ClosablePanelUtil;
