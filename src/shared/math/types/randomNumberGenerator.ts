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