// An endless shuffled order of clips: each of them once a round, and never one twice in a row, even across rounds.
export default class AudioClipShuffler
{
    private readonly clips: string[];
    private readonly random: () => number;
    // The rest of the current round, taken from its end.
    private round: string[] = [];
    private last: string | undefined;

    constructor(clips: readonly string[], random: () => number = Math.random)
    {
        this.clips = [...new Set(clips)];
        this.random = random;
    }

    next(): string
    {
        if (this.round.length == 0)
            this.round = this.shuffle();
        this.last = this.round.pop()!;
        return this.last;
    }

    private shuffle(): string[]
    {
        const round = [...this.clips];
        for (let i = round.length - 1; i > 0; --i)
        {
            const j = Math.floor(this.random() * (i + 1));
            [round[i], round[j]] = [round[j], round[i]];
        }
        const firstIndex = round.length - 1;
        if (firstIndex > 0 && round[firstIndex] == this.last)
            [round[0], round[firstIndex]] = [round[firstIndex], round[0]];
        return round;
    }
}
