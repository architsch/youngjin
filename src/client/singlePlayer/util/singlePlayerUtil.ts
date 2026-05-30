import UserCommandSignal from "../../../shared/user/types/userCommandSignal";
import SocketsClient from "../../networking/client/socketsClient";
import { singlePlayerStepObservable } from "../../system/clientObservables";

const SinglePlayerUtil =
{
    setSinglePlayerStep: (singlePlayerStep: number) =>
    {
        singlePlayerStepObservable.set(singlePlayerStep);
    },
    finishTutorial: () =>
    {
        SocketsClient.emitUserCommandSignal(new UserCommandSignal("finishTutorial"));
    },
}

export default SinglePlayerUtil;