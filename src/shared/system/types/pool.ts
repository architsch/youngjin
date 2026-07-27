export default class Pool<T>
{
    protected size: number;
    protected freeItems: T[];

    constructor(size: number, itemConstructor: (index: number) => T)
    {
        this.size = size;
        this.freeItems = new Array<T>(size);

        for (let index = 0; index < size; ++index)
            this.freeItems[index] = itemConstructor(index);
    }

    // Returns undefined when the pool has nothing left to hand out. Running dry is a legitimate
    // outcome rather than an error — a caller that cannot get an item is expected to carry on
    // without one (e.g. by leaving something undrawn) and try again later, since throwing here
    // would take down whatever loop the caller happens to be running in.
    rentItem(): T | undefined
    {
        return this.freeItems.pop();
    }

    returnItem(item: T): void
    {
        this.freeItems.push(item);
    }

    allItemsAreFree(): boolean
    {
        if (this.freeItems.length > this.size)
            throw new Error(`There are more free items than the ones which were initially allocated (this.freeItems.length = ${this.freeItems.length}, this.size = ${this.size})`);
        return this.freeItems.length == this.size;
    }
}