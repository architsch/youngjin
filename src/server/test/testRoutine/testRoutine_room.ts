import debugUtil from "../../util/debugUtil";
import testActions from "../testActions/testActions";
import testActions_room from "../testActions/testActions_room";

const testRoutine_room = async (): Promise<void> => {
    const numUsers = 12;
    const numRooms = 4;

    // users
    const users: testUser[] = [];
    for (let i = 0; i < numUsers; ++i)
        users.push({userName: `testUser_${i}`, password: `testPass_${i}`, email: `test_email_${i}@test.com`});

    // rooms
    const rooms: testRoom[] = [];
    for (let i = 0; i < numRooms; ++i)
        rooms.push({roomName: `testRoom ${i}`, ownerUserName: ""});

    // user initialization
    for (let i = 0; i < numUsers; ++i)
        await testActions.auth.initUser(users[i]);

    // random actions
    const randomActions = Object.values(testActions_room);

    // run a bunch of random actions
    for (let i = 0; i < 300; ++i)
    {
        const userIndex1 = Math.floor(Math.random() * numUsers);
        const userIndex2 = Math.floor(Math.random() * numUsers);
        const roomIndex = Math.floor(Math.random() * numRooms);
        const actionIndex = Math.floor(Math.random() * randomActions.length);

        debugUtil.log(`RANDOM ACTION: ${i}`, {action: randomActions[actionIndex].name, roomName: rooms[roomIndex].roomName, userName1: users[userIndex1].userName, userName2: users[userIndex2].userName}, "low");
        try {
            await randomActions[actionIndex](rooms[roomIndex], users[userIndex1], users[userIndex2]);
        } catch (_) {}
    }
}

export default testRoutine_room;