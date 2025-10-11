import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import ObjectMessageParams from "../../shared/types/object/objectMessageParams"
import ObjectSyncParams from "../../shared/types/object/objectSyncParams";
import ObjectSpawnParams from "../../shared/types/object/objectSpawnParams";
import ObjectDespawnParams from "../../shared/types/object/objectDespawnParams";
import ObjectRecord from "../../shared/types/object/objectRecord";
import User from "../../shared/types/auth/user";
import RoomLoadParams from "../../shared/types/room/roomLoadParams";

let nsp: socketIO.Namespace;

const objectRecords: {[objectId: string]: ObjectRecord} = {};

const defaultRoomMap = `
GGGGGGGGGGAAAAAAAAACCCCCCCCCCCCC
GggggggggGaHaHaHaHaCcccccccccccC
GggggggggGaaaaaaaaaCcccccccccccC
GggggggggGaaaaaaaaaCCCCCccccCccC
GggggggggGaaaaaaaaaaaaabbbbbbbbB
GggggggggGaaaaahhhhhaaabbbbbBbbB
KaaaaaaaaaaaaaahjjjhaaabbbbbbbbB
KaaaaaaaaaaaaaahjjjhaaabbbbbbbbB
KaaaaaaaaaaaaaahjjjhaaaBBBBBBBBB
DDDDDDDDDaaaaaahjjjhaaaeeeeeeeeE
DdddddddddddaaahjjjhaaaeeeeeeeeE
DdddddddddddaaahhhhhaaaEeeeeeeeE
DdddddddddddaaaaaaaaaaaEeeeeeeeE
DdddddddddddDaaaaaaaaaaEeeeeeeeE
DdddddddddddDiiiiiiiiiiEJeeeeeeE
DDDDDDDDDDDDDiiiiiiiiiiEEEEEEEEE
LLLLLLLLLLmmmmmmmmmNNNNNNNNNNNNN
LllllllllLmmmmmmmmmnnnnnnnnnnnnN
LllllllllLmmmooommmnnnnnnnnnnnnN
LllllllllLmmmooommmnnnnPnnnnnnON
LlllllllllmmmooommmnnnnPnnnnnnnN
LlllllllllmmmooommmnnnnPnnnnnnON
LllllllllLmmmooommmnnnnPnnnnnnnN
LllllllllLmmmooommmnnnnnnnnnnnON
LLLLLLLLLLmmmmmmmmmnnnnnnnnnnnnN
RrrrrrrrssmmmmmmmmmNNqqqqqNNNNNN
RrrrrrrrsssssssssssQQqqqqqQQQQQQ
RrrrrrrRSssssssssssQqqqqqqqqqqqQ
RrrrrrrRSssssssssssQqqqqqqqqqqqQ
RrrrrrrRSssssssssssQqqqqqqqqqqqQ
RrrrrrrRSssssssssssQqqqqqqqqqqqQ
RRRRRRRRSSSSSSSSSSSQQQQQQQQQQQQQ
`.split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n");

const simpleRoomMap = `
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
GgggggGgGgGgGgGgGgGgGggggggggggG
GggggggggggggggggggggggggggggggG
GggggggggggggggggggggggggggggggG
GggggggggggggggggggggggggggggggG
GGGGGGGGGggggggggGGGGGGGGGGGGGGG
GgggggggGggggggggGgggggggggggggG
GgggggggGggggggggGgggggggggggggG
GGggggggGggggggggGgggggggggggggG
GgggggggGgggggggggggggggGggggggG
GGggggggGgggggggggggggggGggggggG
GgggggggGgggggggggggggggGGGGGGGG
GGggggggGgggggggggggggggGggggggG
GgggggggGgggggggggggggggGggggggG
GgggggggggggggggggggggggGggggggG
GGggggggggggggggggggggggGggggggG
GgggggggggggggggggggggggGggggggG
GGggggggggggggggggggggggGggggggG
GggggggggggggggggggggggggggggggG
GGGGGGGGGGGGGGgggggggggggggggggG
GggggggggggggggggggggggggggggggG
GgggggggggggggggggggggggGggggggG
GggggggggggggGggggggggggGggggggG
GggggggggggggGggggggggggGggggggG
GggggggggggggGggggggggggGggggggG
GggggggggggggGggggggggggGggggggG
GggggggggggggGggggggggggGggggggG
GggggggggggggGggggGGGGGGGGGGGGGG
GggggggggggggGgggggggggggggggggG
GggggggggggggGgggggggggggggggggG
GggggggggggggGgggggggggggggggggG
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
`.split("\n").map(x => x.trim()).filter(x => x.length > 0).join("\n");

const GameSockets =
{
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/game_sockets");
        nsp.use(authMiddleware);

        nsp.on("connection", (socket: socketIO.Socket) => {
            const user: User = socket.handshake.auth as User;

            console.log(`(GameSockets) Client connected :: ${JSON.stringify(user)}`);

            socket.on("objectMessage", (params: ObjectMessageParams) => {
                params.message = params.message.trim().substring(0, 32);
                socket.broadcast.to("room_default").emit("objectMessage", params);
            });

            socket.on("objectSync", (params: ObjectSyncParams) => {
                const objectRecord = objectRecords[params.objectId];
                if (objectRecord == undefined)
                {
                    console.error(`Tried to sync a nonexistent object :: ${JSON.stringify(params)}`);
                    return;
                }
                Object.assign(objectRecord.objectSpawnParams.transform, params.transform);
                socket.broadcast.to("room_default").emit("objectSync", params);
            });

            socket.on("objectSpawn", (params: ObjectSpawnParams) => {
                const object = objectRecords[params.objectId];
                if (object != undefined)
                {
                    console.error(`Tried to spawn an already existing object :: ${JSON.stringify(params)}`);
                    return;
                }
                const transformCopy = {};
                Object.assign(transformCopy, params.transform);

                objectRecords[params.objectId] = { objectSpawnParams: params };

                socket.broadcast.to("room_default").emit("objectSpawn", params);
            });

            socket.on("objectDespawn", (params: ObjectDespawnParams) => {
                const object = objectRecords[params.objectId];
                if (object == undefined)
                {
                    console.error(`Tried to despawn a nonexistent object :: ${JSON.stringify(params)}`);
                    return;
                }
                delete objectRecords[params.objectId];

                socket.broadcast.to("room_default").emit("objectDespawn", params);
            });

            socket.on("disconnect", () => {
                console.log(`(GameSockets) Client disconnected :: ${JSON.stringify(user)}`);
                
                const despawnPendingObjectIds: string[] = [];
                for (const objectRecord of Object.values(objectRecords))
                {
                    const params = objectRecord.objectSpawnParams;
                    if (params.objectId.startsWith(user.userName))
                    {
                        console.log(`Despawned :: ${params.objectId}`);
                        despawnPendingObjectIds.push(params.objectId);
                    }
                }
                for (const objectId of despawnPendingObjectIds)
                {
                    if (objectRecords[objectId] != undefined)
                        delete objectRecords[objectId];
                    nsp.to("room_default").emit("objectDespawn", { objectId });
                }
            });

            socket.join("room_default");

            const roomLoadParams: RoomLoadParams = {
                //roomMap: defaultRoomMap,
                roomMap: simpleRoomMap,
                objectRecords
            }
            socket.emit("roomLoad", roomLoadParams);
        });
    },
};

export default GameSockets;