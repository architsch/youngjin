/**
 * Stand-ins for the Web Audio API and for what the audio system reads of the page, for suites that run without a
 * browser. Nodes record what they feed and what their parameters were told, sources what they were started and stopped
 * with. Time moves only by FakeAudioContext.advance, which ends each source when its time comes. Call stubWebAudio in
 * beforeEach and vi.unstubAllGlobals in afterEach.
 */
import { vi } from "vitest";

export class FakeAudioParam
{
    value: number;
    readonly events: {type: "set" | "target" | "ramp" | "cancel", value: number, time: number, timeConstant?: number}[] = [];

    constructor(value: number) { this.value = value; }

    setValueAtTime(value: number, time: number) { this.events.push({type: "set", value, time}); this.value = value; return this; }
    setTargetAtTime(value: number, time: number, timeConstant: number) { this.events.push({type: "target", value, time, timeConstant}); return this; }
    linearRampToValueAtTime(value: number, time: number) { this.events.push({type: "ramp", value, time}); return this; }
    cancelScheduledValues(time: number) { this.events.push({type: "cancel", value: NaN, time}); return this; }

    /** Where it heads: the last value it was set to, sent toward or ramped to. */
    get target(): number
    {
        const last = [...this.events].reverse().find(event => event.type != "cancel");
        return last?.value ?? this.value;
    }
}

export class FakeAudioNode
{
    readonly outputs: FakeAudioNode[] = [];
    channelCount = 2;
    channelCountMode = "max";

    connect<T extends FakeAudioNode>(node: T): T { this.outputs.push(node); return node; }
    disconnect(): void { this.outputs.length = 0; }
}

export class FakeGainNode extends FakeAudioNode
{
    readonly gain = new FakeAudioParam(1);
}

export class FakeStereoPannerNode extends FakeAudioNode
{
    readonly pan = new FakeAudioParam(0);
}

export class FakeBiquadFilterNode extends FakeAudioNode
{
    type = "lowpass";
    readonly frequency = new FakeAudioParam(350);
}

/** An <audio> element as a stream plays through one; whether play() may start is FakeMediaElement.mayPlay. */
export class FakeMediaElement
{
    static mayPlay = true;
    static readonly instances: FakeMediaElement[] = [];

    src = "";
    crossOrigin: string | null = null;
    preload = "";
    loop = false;
    playbackRate = 1;
    preservesPitch = true;
    paused = true;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    readonly calls: string[] = [];

    constructor() { FakeMediaElement.instances.push(this); }

    play(): Promise<void>
    {
        this.calls.push(`play ${this.src}`);
        if (!FakeMediaElement.mayPlay)
            return Promise.reject(new DOMException("The user hasn't interacted with the page.", "NotAllowedError"));
        this.paused = false;
        return Promise.resolve();
    }
    pause(): void { this.calls.push("pause"); this.paused = true; }
    load(): void { this.calls.push("load"); }
    removeAttribute(name: string): void { if (name == "src") this.src = ""; }

    /** As the browser ends one that has played through. */
    end(): void { this.paused = true; this.onended?.(); }
    fail(): void { this.onerror?.(); }
}

export class FakeMediaElementSourceNode extends FakeAudioNode
{
    constructor(readonly element: FakeMediaElement) { super(); }
}

export class FakeAudioBuffer
{
    constructor(readonly channels: Float32Array[], readonly sampleRate: number) {}

    get length(): number { return this.channels[0].length; }
    get duration(): number { return this.length / this.sampleRate; }
    get numberOfChannels(): number { return this.channels.length; }
    getChannelData(channel: number): Float32Array { return this.channels[channel]; }
}

export class FakeAudioBufferSourceNode extends FakeAudioNode
{
    buffer: FakeAudioBuffer | null = null;
    loop = false;
    loopStart = 0;
    loopEnd = 0;
    readonly playbackRate = new FakeAudioParam(1);
    onended: (() => void) | null = null;
    started: {when: number, offset: number, duration?: number, at: number} | undefined;
    stopTime: number | undefined;
    ended = false;

    constructor(private readonly context: FakeAudioContext) { super(); }

    start(when: number = 0, offset: number = 0, duration?: number): void
    {
        if (this.started)
            throw new Error("A source can start only once.");
        this.started = {when, offset, duration, at: this.context.currentTime};
    }

    stop(when: number = 0): void
    {
        if (!this.started)
            throw new Error("A source can't stop before it starts.");
        this.stopTime = when;
    }

    /** When it ends, by itself or by being stopped (as the audio thread would end it); Infinity if never. */
    getEndTime(): number
    {
        if (!this.started)
            return Infinity;
        const stop = this.stopTime ?? Infinity;
        if (this.loop)
            return stop;
        const begin = Math.max(this.started.when, this.started.at);
        // Its duration is of the buffer's time, which it goes through as fast as it plays.
        const natural = begin + (this.started.duration ?? (this.buffer!.duration - this.started.offset))
            / this.playbackRate.value;
        return Math.min(natural, stop);
    }
}

export class FakeAudioContext
{
    static readonly instances: FakeAudioContext[] = [];
    /** What decodeAudioData gives back for the bytes it is handed; a test sets it. */
    static decode: (bytes: ArrayBuffer) => FakeAudioBuffer | Promise<FakeAudioBuffer> =
        () => new FakeAudioBuffer([new Float32Array(1)], 48000);
    /** Whether resume may start a context, as an autoplay policy would let it. */
    static mayStart = true;

    currentTime = 0;
    state: "suspended" | "running" | "closed" = "suspended";
    readonly sampleRate = 48000;
    readonly destination = new FakeAudioNode();
    readonly sources: FakeAudioBufferSourceNode[] = [];
    readonly gains: FakeGainNode[] = [];
    readonly panners: FakeStereoPannerNode[] = [];
    readonly filters: FakeBiquadFilterNode[] = [];
    readonly mediaSources: FakeMediaElementSourceNode[] = [];
    readonly calls: string[] = [];
    private readonly listeners: (() => void)[] = [];

    // As the standard has it: suspended at first, and running a task later if it may start.
    constructor()
    {
        FakeAudioContext.instances.push(this);
        if (FakeAudioContext.mayStart)
            setTimeout(() => this.setState("running"), 0);
    }

    createGain(): FakeGainNode { const node = new FakeGainNode(); this.gains.push(node); return node; }
    createStereoPanner(): FakeStereoPannerNode { const node = new FakeStereoPannerNode(); this.panners.push(node); return node; }
    createBiquadFilter(): FakeBiquadFilterNode { const node = new FakeBiquadFilterNode(); this.filters.push(node); return node; }
    createMediaElementSource(element: FakeMediaElement): FakeMediaElementSourceNode
    {
        if (this.mediaSources.some(node => node.element == element))
            throw new Error("An element feeds a context through one node only.");
        const node = new FakeMediaElementSourceNode(element);
        this.mediaSources.push(node);
        return node;
    }
    createBufferSource(): FakeAudioBufferSourceNode
    {
        const source = new FakeAudioBufferSourceNode(this);
        this.sources.push(source);
        return source;
    }
    async decodeAudioData(bytes: ArrayBuffer): Promise<FakeAudioBuffer> { return await FakeAudioContext.decode(bytes); }
    async resume(): Promise<void> { this.calls.push("resume"); if (FakeAudioContext.mayStart) this.setState("running"); }
    async suspend(): Promise<void> { this.calls.push("suspend"); this.setState("suspended"); }
    addEventListener(type: string, listener: () => void): void { if (type == "statechange") this.listeners.push(listener); }

    /** Moves time on, ending each source as its time comes, in the order they end. */
    advance(seconds: number): void
    {
        const until = this.currentTime + seconds;
        for (;;)
        {
            let next: FakeAudioBufferSourceNode | undefined;
            for (const source of this.sources)
            {
                if (!source.ended && source.getEndTime() <= until && (!next || source.getEndTime() < next.getEndTime()))
                    next = source;
            }
            if (!next)
                break;
            this.currentTime = Math.max(this.currentTime, next.getEndTime());
            next.ended = true;
            next.onended?.();
        }
        this.currentTime = until;
    }

    private setState(state: "suspended" | "running"): void
    {
        if (this.state == state)
            return;
        this.state = state;
        for (const listener of this.listeners)
            listener();
    }
}

/** The page as the audio system sees it: its input listeners, whether it is shown, and whether it has been used. */
export class FakePage
{
    visibilityState: "visible" | "hidden" = "visible";
    readonly fetched: string[] = [];
    readonly window: {addEventListener: (type: string, listener: () => void) => void,
        removeEventListener: (type: string, listener: () => void) => void};
    readonly document: {readonly visibilityState: string, addEventListener: (type: string, listener: () => void) => void};
    private readonly windowListeners = new Map<string, Set<() => void>>();
    private readonly documentListeners = new Map<string, Set<() => void>>();

    constructor(readonly navigator: {userActivation?: {hasBeenActive: boolean}})
    {
        const getVisibility = () => this.visibilityState;
        this.window = {
            addEventListener: (type, listener) => { this.listenersOf(this.windowListeners, type).add(listener); },
            removeEventListener: (type, listener) => { this.listenersOf(this.windowListeners, type).delete(listener); },
        };
        this.document = {
            get visibilityState() { return getVisibility(); },
            addEventListener: (type, listener) => { this.listenersOf(this.documentListeners, type).add(listener); },
        };
    }

    /** An input of the given type, as the user makes it. */
    input(type: string): void
    {
        for (const listener of [...this.listenersOf(this.windowListeners, type)])
            listener();
    }

    setVisibility(state: "visible" | "hidden"): void
    {
        this.visibilityState = state;
        for (const listener of [...this.listenersOf(this.documentListeners, "visibilitychange")])
            listener();
    }

    numInputListeners(): number
    {
        return [...this.windowListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
    }

    private listenersOf(map: Map<string, Set<() => void>>, type: string): Set<() => void>
    {
        if (!map.has(type))
            map.set(type, new Set());
        return map.get(type)!;
    }
}

/** Stands in the Web Audio API and the page, on a page not used yet unless hasBeenActive. */
export function stubWebAudio(options?: {hasBeenActive?: boolean, bundleBytes?: ArrayBuffer, fetchFails?: boolean}): FakePage
{
    FakeAudioContext.instances.length = 0;
    FakeAudioContext.mayStart = true;
    FakeMediaElement.instances.length = 0;
    FakeMediaElement.mayPlay = true;
    const fake = new FakePage({userActivation: {hasBeenActive: options?.hasBeenActive ?? false}});
    vi.stubGlobal("window", fake.window);
    vi.stubGlobal("document", fake.document);
    vi.stubGlobal("navigator", fake.navigator);
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("Audio", FakeMediaElement);
    vi.stubGlobal("fetch", async (url: string) => {
        fake.fetched.push(url);
        if (options?.fetchFails)
            return {ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0)};
        return {ok: true, status: 200, arrayBuffer: async () => options?.bundleBytes ?? new ArrayBuffer(8)};
    });
    return fake;
}
