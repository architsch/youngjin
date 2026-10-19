import EncodableData from "../../../shared/networking/types/encodableData";
import EncodingUtil from "../../../shared/networking/util/encodingUtil";
import UserSignalDispatchUtil from "../../user/util/userSignalDispatchUtil";
import AgentUserContext from "../types/agentUserContext";

const AgentSignalUtil =
{
    // Sends a signal as the agent, encoded as a browser sends it, so it passes the throttle, checks and
    // milestones a person's would. Resolves to whether it was handled (see UserSignalDispatchUtil.dispatch).
    send: async (ctx: AgentUserContext, signalType: string, signal: EncodableData): Promise<boolean> =>
    {
        const bufferState = EncodingUtil.startEncoding();
        signal.encode(bufferState);
        // An edit is handled before dispatch first awaits, so whatever edit the agent is sent meanwhile answers
        // this one, and is no news (see AgentInbox.muted).
        ctx.inbox.muted = true;
        const handled = UserSignalDispatchUtil.dispatch(ctx, signalType, EncodingUtil.endEncoding(bufferState));
        ctx.inbox.muted = false;
        return await handled;
    },
}

export default AgentSignalUtil;
