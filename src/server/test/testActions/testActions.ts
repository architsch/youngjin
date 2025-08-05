import auth from "./TestActions_Auth";
import room from "./TestActions_Room";

const TestActions:
    {[categoryName: string]: {[actionName: string]: (...args: any[]) => Promise<void>}} =
{
    auth, room,
}

export default TestActions;