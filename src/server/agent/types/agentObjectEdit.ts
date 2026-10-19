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
}
