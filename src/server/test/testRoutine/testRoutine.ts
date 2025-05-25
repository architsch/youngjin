import room from "./testRoutine_room";

const testRoutine: {[testname: string]: () => Promise<void>} =
{
    room,
}

export default testRoutine;