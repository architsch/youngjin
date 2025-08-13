import room from "./TestRoutine_Room";

const TestRoutine: {[testname: string]: () => Promise<void>} =
{
    room,
}

export default TestRoutine;