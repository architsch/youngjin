import ClientEvent from "../types/clientEvent";
import { ClientEventType } from "../types/clientEventType";

const history: Map<ClientEventType, ClientEvent[]> = new Map();

const ClientEventHistoryUtil =
{
    add: (event: ClientEvent) =>
    {
        let events = history.get(event.type);
        if (events == undefined)
        {
            events = new Array<ClientEvent>();
            history.set(event.type, events);
        }
        events.push(event);
    },
    // Returns -1 if no event is found.
    getLatestEventTime: (type: ClientEventType): number =>
    {
        let events = history.get(type);
        if (events == undefined || events.length == 0)
            return -1;
        return events[events.length-1].time;
    },
    getNumEventsAfterTime: (type: ClientEventType, time: number): number =>
    {
        let events = history.get(type);
        if (events == undefined)
            return 0;
        let count = 0;
        for (let i = events.length-1; i >= 0; --i)
        {
            const event = events[i];
            if (event.time <= time)
                return count;
            ++count;
        }
        return count;
    },
    clear: () =>
    {
        history.clear();
    },
}

export default ClientEventHistoryUtil;
