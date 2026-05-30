import Observable from "./observable";

export default class ObservableSet<ElementType> extends Observable<Set<ElementType>>
{
    // Keyed by element first, then by listener name within that element.
    // Keying by the element directly (rather than by a composite object) means the Map
    // compares primitive elements — e.g. FeatureFlag enum values — by value, matching the
    // underlying Set's semantics. A composite-object key would compare by reference and
    // never match on lookup/removal.
    protected elementListeners = new Map<ElementType, Map<string, ElementListenerCallback>>();

    constructor()
    {
        super(new Set<ElementType>());
    }

    addElementListener(name: string, element: ElementType, callback: ElementListenerCallback)
    {
        let listenersByName = this.elementListeners.get(element);
        if (!listenersByName)
        {
            listenersByName = new Map<string, ElementListenerCallback>();
            this.elementListeners.set(element, listenersByName);
        }
        if (listenersByName.has(name))
            throw new Error(`Listener key already exists (name = ${name}, element = ${String(element)})`);
        listenersByName.set(name, callback);
    }

    removeElementListener(name: string, element: ElementType)
    {
        const listenersByName = this.elementListeners.get(element);
        if (!listenersByName || !listenersByName.has(name))
            throw new Error(`Listener key doesn't exist (name = ${name}, element = ${String(element)})`);
        listenersByName.delete(name);
        if (listenersByName.size === 0)
            this.elementListeners.delete(element);
    }

    tryAdd(element: ElementType): boolean
    {
        const set = this.currValue!;
        if (set.has(element))
            return false;
        set.add(element);
        this.set(set);
        this.notifyElementListeners(element, "add");
        return true;
    }

    tryRemove(element: ElementType): boolean
    {
        const set = this.currValue!;
        if (!set.has(element))
            return false;
        set.delete(element);
        this.set(set);
        this.notifyElementListeners(element, "remove");
        return true;
    }

    has(element: ElementType): boolean
    {
        const set = this.currValue!;
        return set.has(element);
    }

    private notifyElementListeners(element: ElementType, action: "add" | "remove")
    {
        // Map.forEach (not for...of) so this compiles cleanly under the es5 target.
        const listenersByName = this.elementListeners.get(element);
        if (listenersByName)
            listenersByName.forEach(listener => listener(action));
    }
}

type ElementListenerCallback = (action: "add" | "remove") => (void | Promise<void>);
