import AgentFace from "./agentFace";
import { AgentSide } from "./agentSide";

// What an agent asks to add, and where (see AgentObjectUtil.addObject). Each type reads only what it uses.
export default interface AgentObjectRequest
{
    type: string;
    on: AgentFace;
    picture?: string;
    text?: string;
    // In blocks.
    width?: number;
    height?: number;
    look?: number;
    // Where the top of a picture on a floor or ceiling points.
    top?: AgentSide;
    destination?: string;
    arriveAt?: string;
}
