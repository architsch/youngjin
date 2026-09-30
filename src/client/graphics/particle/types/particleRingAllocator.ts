// Where each transient particle goes: a ring whose head wraps, so a full ring overwrites its oldest
// particles and can never exceed its budget. What was written since the last flush is at most two runs
// (the ring's end, then its start), which map directly onto buffer upload ranges.
export default class ParticleRingAllocator
{
    readonly capacity: number;
    private head = 0;
    private highWaterMark = 0;
    private dirtyStart = 0;
    private dirtyCount = 0;

    constructor(capacity: number)
    {
        this.capacity = capacity;
    }

    // The index the next particle goes to, or -1 for a ring with no capacity.
    allocate(): number
    {
        if (this.capacity <= 0)
            return -1;
        if (this.dirtyCount == 0)
            this.dirtyStart = this.head;

        const index = this.head;
        this.head = (this.head + 1) % this.capacity;
        this.dirtyCount = Math.min(this.dirtyCount + 1, this.capacity);
        this.highWaterMark = Math.max(this.highWaterMark, index + 1);
        return index;
    }

    // Only entries below this have been written since the last reset, so only they need drawing.
    getHighWaterMark(): number
    {
        return this.highWaterMark;
    }

    // The runs written since the last call, into the caller's array (to avoid per-frame allocation).
    takeDirtyRanges(out: {start: number, count: number}[]): {start: number, count: number}[]
    {
        out.length = 0;
        if (this.dirtyCount == 0)
            return out;
        if (this.dirtyCount >= this.capacity)
        {
            out.push({start: 0, count: this.capacity});
        }
        else
        {
            const end = this.dirtyStart + this.dirtyCount;
            if (end <= this.capacity)
            {
                out.push({start: this.dirtyStart, count: this.dirtyCount});
            }
            else
            {
                out.push({start: this.dirtyStart, count: this.capacity - this.dirtyStart});
                out.push({start: 0, count: end - this.capacity});
            }
        }
        this.dirtyCount = 0;
        return out;
    }

    reset(): void
    {
        this.head = 0;
        this.highWaterMark = 0;
        this.dirtyCount = 0;
    }
}
