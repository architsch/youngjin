import Observable from "./observable";

export default class ObservableMap<ValueType> extends Observable<{[key: string]: ValueType}>
{
    constructor()
    {
        super({});
    }

    tryAdd(key: string, value: ValueType, unicastKey?: string): boolean
    {
        const map = this.currValue!;
        if (map[key] != undefined)
            return false;
        map[key] = value;
        this.set(map, unicastKey);
        //console.log("tryAdd -> " + JSON.stringify(map));
        return true;
    }

    tryRemove(key: string, unicastKey?: string): boolean
    {
        const map = this.currValue!;
        if (map[key] == undefined)
            return false;
        delete map[key];
        this.set(map, unicastKey);
        //console.log("tryRemove -> " + JSON.stringify(map));
        return true;
    }

    tryUpdate(key: string, changeFunc: (prevValue: ValueType) => ValueType,
        changeCond?: (prevValue: ValueType) => boolean,
        unicastKey?: string): boolean
    {
        const map = this.currValue!;
        const value = map[key];
        if (value == undefined) // entry not found
            return false;
        if (changeCond && !changeCond(value)) // condition not met
            return false;
        map[key] = changeFunc(value);
        this.set(map, unicastKey);
        //console.log("tryUpdate -> " + JSON.stringify(map));
        return true;
    }

    peekValue(key: string): ValueType | undefined
    {
        const map = this.currValue!;
        return map[key];
    }
}