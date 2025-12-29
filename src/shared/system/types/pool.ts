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

    rentItem(): T
    {
        if (this.freeItems.length == 0)
            throw new Error("No free item available in the pool.");
        return this.freeItems.pop()!;
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