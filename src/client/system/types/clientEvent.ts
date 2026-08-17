import { ClientEventType } from "./clientEventType";

export default class ClientEvent
{
    type: ClientEventType;
    time: number;

    constructor(type: ClientEventType)
    {
        this.type = type;
        this.time = performance.now();
    }
}