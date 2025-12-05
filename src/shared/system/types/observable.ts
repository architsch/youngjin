export default class Observable<ValueType>
{
    protected listeners: {[key: string]: (value: ValueType) => (void | Promise<void>)} = {};
    protected currValue: ValueType | undefined;

    constructor(defaultValue?: ValueType)
    {
        this.currValue = defaultValue;
    }

    set(value: ValueType, unicastKey?: string): void
    {
        this.currValue = value;

        if (unicastKey) // unicast
        {
            const listener = this.listeners[unicastKey];
            if (listener != undefined)
                listener(value);
            else
                console.error(`Unicast key not found in the map of listeners (key = ${unicastKey})`);
        }
        else // broadcast
        {
            for (const listener of Object.values(this.listeners))
                listener(value);
        }
    }

    change(changeFunc: (prevValue: ValueType) => ValueType, unicastKey?: string): void
    {
        if (this.currValue === undefined)
            throw new Error(`Tried to apply a change to an undefined currValue in an Observable.`);
        const newValue = changeFunc(this.currValue);
        this.set(newValue, unicastKey);
    }

    peek(): ValueType
    {
        if (this.currValue === undefined)
            throw new Error(`Tried to access an undefined currValue in an Observable.`);
        return this.currValue;
    }

    addListener(key: string, callback: (value: ValueType) => (void | Promise<void>)): void
    {
        if (this.listeners[key] != undefined)
            throw new Error(`Listener key already exists (key = ${key})`);
        this.listeners[key] = callback;
    }

    removeListener(key: string): void
    {
        if (this.listeners[key] === undefined)
            throw new Error(`Listener key doesn't exist (key = ${key})`);
        delete this.listeners[key];
    }
}