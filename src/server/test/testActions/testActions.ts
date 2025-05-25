import auth from "./testActions_auth";
import room from "./testActions_room";

const testActions:
    {[categoryName: string]: {[actionName: string]: (...args: any[]) => Promise<void>}} =
{
    auth, room,
}

export default testActions;