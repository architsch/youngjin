const testActions = require("./testActions/testActions");

// users
const u = [];
for (let i = 0; i < 10; ++i)
    u.push({userName: `testUser_${i}`, password: `testPass_${i}`, email: `test_email_${i}@test.com`});

// rooms
const r = [];
for (let i = 0; i < 10; ++i)
    r.push({roomName: `testRoom ${i}`});

const testRoutines =
{
    "default": async () => {
        const numUsers = 1;
        for (let i = 0; i < numUsers; ++i)
            await testActions.auth.initUser(u[i]);
        /*await testActions.room.create(r[0], u[0]);
        await testActions.room.invite(r[0], u[0], u[1]);
        await testActions.room.invite(r[0], u[0], u[2]);
        await testActions.room.acceptInvitation(r[0], u[1]);
        await testActions.room.ignoreInvitation(r[0], u[2]);
        await testActions.room.requestToJoin(r[0], u[2]);
        await testActions.room.create(r[1], u[1]);
        await testActions.room.requestToJoin(r[1], u[0], u[1]);
        await testActions.room.cancelRequest(r[0], u[2]);*/
    },
}

module.exports = testRoutines;