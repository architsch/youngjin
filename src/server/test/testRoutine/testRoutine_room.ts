import DebugUtil from "../../util/debugUtil";
import TestActions from "../testActions/testActions";
import TestActions_Room from "../testActions/testActions_room";

const TestRoutine_Room = async (): Promise<void> => {
    const numUsers = 4;
    const numRooms = 3;

    // users
    const users: TestUser[] = [];
    for (let i = 0; i < numUsers; ++i)
        users.push({userName: `testUser_${i}`, userType: "member", password: `testPass_${i}`, email: `test_email_${i}@test.com`});

    // rooms
    const rooms: TestRoom[] = [];
    for (let i = 0; i < numRooms; ++i)
        rooms.push({roomName: `testRoom ${i}`, ownerUserName: ""});

    // user initialization
    for (let i = 0; i < numUsers; ++i)
        await TestActions.auth.initUser(users[i]);

    // random actions
    const randomActions = Object.values(TestActions_Room);

    // run a bunch of random actions
    for (let i = 0; i < 300; ++i)
    {
        const userIndex1 = Math.floor(Math.random() * numUsers);
        const userIndex2 = Math.floor(Math.random() * numUsers);
        const roomIndex = Math.floor(Math.random() * numRooms);
        const actionIndex = Math.floor(Math.random() * randomActions.length);

        DebugUtil.log(`RANDOM ACTION: ${i}`, {action: randomActions[actionIndex].name, roomName: rooms[roomIndex].roomName, userName1: users[userIndex1].userName, userName2: users[userIndex2].userName}, "low");
        try {
            await randomActions[actionIndex](rooms[roomIndex], users[userIndex1], users[userIndex2]);
        } catch (_) {}
    }
}

export default TestRoutine_Room;