// What an agent asks to change of something placed (see AgentObjectUtil.editObject). Each type takes only its own.
export default interface AgentObjectEdit
{
    id: string;
    text?: string;
    picture?: string;
    look?: number;
    destination?: string;
    arriveAt?: string;
    keepFor?: string;
    name?: string;
    // A cannon's switch.
    switchedOn?: boolean;
    // Quarter turns clockwise for a cannon's scrap, as seen from in front of the side it lies on.
    turn?: number;
}
