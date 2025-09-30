import socketIO from "socket.io";
import { SocketMiddleware } from "./types/socketMiddleware";
import MessageParams from "../../shared/types/networking/messageParams"
import ObjectSyncParams from "../../shared/types/networking/objectSyncParams";
import ObjectSpawnParams from "../../shared/types/networking/objectSpawnParams";
import ObjectDespawnParams from "../../shared/types/networking/objectDespawnParams";
import ObjectRecord from "../../shared/types/networking/objectRecord";
import User from "../../shared/types/db/user";
import ObjectTransform from "../../shared/types/networking/objectTransform";

let nsp: socketIO.Namespace;

const objectRecords: {[objectId: string]: ObjectRecord} = {};

const GameSockets =
{
    init: (io: socketIO.Server, authMiddleware: SocketMiddleware): void =>
    {
        nsp = io.of("/game_sockets");
        nsp.use(authMiddleware);

        nsp.on("connection", (socket: socketIO.Socket) => {
            const user: User = socket.handshake.auth as User;

            console.log(`(GameSockets) Client connected :: ${JSON.stringify(user)}`);

            socket.on("message", (params: MessageParams) => {
                nsp.to("room_default").emit("message", params);
            });

            socket.on("objectSync", (params: ObjectSyncParams) => {
                const objectRecord = objectRecords[params.objectId];
                if (objectRecord == undefined)
                {
                    console.error(`Tried to sync a nonexistent object :: ${JSON.stringify(params)}`);
                    return;
                }
                Object.assign(objectRecord.transform, params.transform);
                nsp.to("room_default").emit("objectSync", params);
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

                objectRecords[params.objectId] = {
                    objectType: params.objectType,
                    objectId: params.objectId,
                    transform: transformCopy as ObjectTransform,
                };

                nsp.to("room_default").emit("objectSpawn", params);
            });

            socket.on("objectDespawn", (params: ObjectDespawnParams) => {
                const object = objectRecords[params.objectId];
                if (object == undefined)
                {
                    console.error(`Tried to despawn a nonexistent object :: ${JSON.stringify(params)}`);
                    return;
                }
                delete objectRecords[params.objectId];

                nsp.to("room_default").emit("objectDespawn", params);
            });

            socket.on("disconnect", () => {
                console.log(`(GameSockets) Client disconnected :: ${JSON.stringify(user)}`);
                
                const despawnPendingObjectIds: string[] = [];
                for (const objectRecord of Object.values(objectRecords))
                {
                    if (objectRecord.objectId.startsWith(user.userName))
                    {
                        console.log(`Despawned :: ${objectRecord.objectId}`);
                        despawnPendingObjectIds.push(objectRecord.objectId);
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

            socket.emit("worldSync", { objectRecords });
        });
    },
};

export default GameSockets;