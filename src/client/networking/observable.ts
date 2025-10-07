export default class Observable<ValueType>
{
    private listeners: {[key: string]: (value: ValueType) => void} = {};

    broadcast(value: ValueType): void
    {
        for (const listener of Object.values(this.listeners))
            listener(value);
    }

    addListener(key: string, callback: (value: ValueType) => void): void
    {
        if (this.listeners[key] != undefined)
            throw new Error(`Listener key already exists (key = ${key})`);
        this.listeners[key] = callback;
    }

    removeListener(key: string): void
    {
        if (this.listeners[key] == undefined)
            throw new Error(`Listener key doesn't exist (key = ${key})`);
        delete this.listeners[key];
    }
}