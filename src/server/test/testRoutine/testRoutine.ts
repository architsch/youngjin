import room from "./testRoutine_room";

const TestRoutine: {[testname: string]: () => Promise<void>} =
{
    room,
}

export default TestRoutine;