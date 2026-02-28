import { EventEmitter } from "events";
import User from "../../../src/shared/user/types/user";

/**
 * Lightweight mock of a Socket.IO socket for server-side integration tests.
 * Implements only the surface area used by SocketUserContext, GameSockets, and
 * RoomManager — no real network I/O.
 */
export class MockSocket extends EventEmitter
{
    id: string;
    connected: boolean;
    handshake: { auth: User };

    /** Signals emitted *to* this socket (what a real client would receive). */
    emitted: Array<{ event: string; data: any }>;

    constructor(user: User)
    {
        super();
        this.id = `mock-socket-${user.id}`;
        this.connected = true;
        this.handshake = { auth: user };
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
        // The real Socket.IO socket fires "disconnect" when the transport closes.
        // In tests the disconnect handler is attached via `socket.on("disconnect", ...)`
        // inside gameSockets, so we emit it here.
        super.emit("disconnect");
    }

    /** Returns all payloads emitted for the given event name. */
    getEmitted(event: string): any[]
    {
        return this.emitted.filter(e => e.event === event).map(e => e.data);
    }

    /** Clears recorded emissions. */
    clearEmitted(): void
    {
        this.emitted = [];
    }
}
