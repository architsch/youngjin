// Stack of open closable panels (newest last). Panels register themselves from anywhere in the tree;
// the back gesture closes the newest one per gesture (see UIRoot).

// Each entry's close callback. Panels remove their own entry when they unmount.
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
