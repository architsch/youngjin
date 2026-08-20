export default class RandomNumberGenerator
{
    private seed: number;

    constructor(seed: number)
    {
        this.seed = seed;
    }

    randomInt(min: number, max: number): number // range = [min,max)
    {
        return min + Math.floor(this.generate() * (max - min));
    }

    randomFloat(min: number, max: number): number // range = [min,max)
    {
        return min + this.generate() * (max - min);
    }

    // One of the items, drawn at random.
    pick<T>(items: T[]): T
    {
        return items[this.randomInt(0, items.length)];
    }

    // Rearranges the items into a random order, in place, and hands the same array back. Callers
    // that must not disturb the array they were given pass a copy of it.
    shuffle<T>(items: T[]): T[]
    {
        for (let i = items.length - 1; i > 0; --i)
        {
            const j = this.randomInt(0, i + 1);
            const temp = items[i];
            items[i] = items[j];
            items[j] = temp;
        }
        return items;
    }

    private generate()
    {
        // Use Mulberry32 algorithm for random number generation
        this.seed = (this.seed + 0x6D2B79F5) | 0;
        let t = this.seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}