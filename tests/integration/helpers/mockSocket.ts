import { EventEmitter } from "events";
import { inflateSync } from "fflate";
import User from "../../../src/shared/user/types/user";

/** Minimal Socket.IO socket mock for server-side tests (no network I/O). */
export class MockSocket extends EventEmitter
{
    id: string;
    connected: boolean;
    handshake: { auth: { user: User; targetRoomID?: string } };

    /** Signals emitted *to* this socket (what a real client would receive). */
    emitted: Array<{ event: string; data: any }>;

    constructor(user: User)
    {
        super();
        this.id = `mock-socket-${user.id}`;
        this.connected = true;
        this.handshake = { auth: { user } };
        this.emitted = [];
    }

    /** Capture outgoing server→client emissions for assertions. */
    emit(event: string, ...args: any[]): boolean
    {
        this.emitted.push({ event, data: args[0] });
        return super.emit(event, ...args);
    }

    /** Simulates a clean server-side disconnect. */
    disconnect(_close?: boolean): void
    {
        this.connected = false;
        // Mirrors the transport-close "disconnect" event the server listens for.
        super.emit("disconnect");
    }

    /** Returns all payloads emitted for the given event name. */
    getEmitted(event: string): any[]
    {
        return this.emitted.filter(e => e.event === event).map(e => e.data);
    }

    /** The signal batches emitted, in order, each as the client reads it: a deflated one inflated. */
    getEmittedSignalBatches(): Uint8Array[]
    {
        const batches: Uint8Array[] = [];
        for (const { event, data } of this.emitted)
        {
            if (event === "signalBatch")
                batches.push(new Uint8Array(data));
            else if (event === "deflatedSignalBatch")
                batches.push(inflateSync(new Uint8Array(data)));
        }
        return batches;
    }

    /** Clears recorded emissions. */
    clearEmitted(): void
    {
        this.emitted = [];
    }
}
