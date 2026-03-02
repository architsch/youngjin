import App from "../app";
import ObjectFactory from "./factories/objectFactory";
import ObjectManager from "./objectManager";
import ObjectTransform from "../../shared/object/types/objectTransform";
import ObjectSpawnParams from "../../shared/object/types/objectSpawnParams";
import UpdatePersistentObjectGroupParams from "../../shared/object/types/update/updatePersistentObjectGroupParams";
import AddPersistentObjectParams from "../../shared/object/types/update/addPersistentObjectParams";
import RemovePersistentObjectParams from "../../shared/object/types/update/removePersistentObjectParams";
import MovePersistentObjectParams from "../../shared/object/types/update/movePersistentObjectParams";
import SetPersistentObjectMetadataParams from "../../shared/object/types/update/setPersistentObjectMetadataParams";
import { addPersistentObject, directionStringToVector, movePersistentObject, removePersistentObject, setPersistentObjectMetadata } from "../../shared/object/util/persistentObjectUpdateUtil";
import { PERSISTENT_OBJ_TASK_TYPE_ADD, PERSISTENT_OBJ_TASK_TYPE_MOVE, PERSISTENT_OBJ_TASK_TYPE_REMOVE, PERSISTENT_OBJ_TASK_TYPE_SET_METADATA } from "../../shared/system/sharedConstants";
import AsyncUtil from "../../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import { persistentObjectSelectionObservable } from "../system/clientObservables";
import CanvasGameObject from "./types/canvasGameObject";

const PersistentObjectManager =
{
    onUpdatePersistentObjectGroupReceived: async (params: UpdatePersistentObjectGroupParams) =>
    {
        const success = await waitUntilSignalProcessingReady("updatePersistentObjectGroupParams",
            () => App.getCurrentRoom() != undefined && App.getCurrentRoom()!.id == params.roomID);
        if (!success)
            return;

        const room = App.getCurrentRoom()!;
        for (const task of params.tasks)
        {
            switch (task.type)
            {
                case PERSISTENT_OBJ_TASK_TYPE_ADD:
                {
                    const addParams = task as AddPersistentObjectParams;
                    const dirStr = addParams.getDirectionString();
                    const po = addPersistentObject(room, addParams.objectTypeIndex,
                        dirStr, addParams.x, addParams.y, addParams.z, addParams.metadata);
                    if (po)
                    {
                        const {dirX, dirY, dirZ} = directionStringToVector(dirStr);
                        const objectSpawnParams = new ObjectSpawnParams(
                            room.id, "", "", addParams.objectTypeIndex,
                            po.objectId,
                            new ObjectTransform(addParams.x, addParams.y, addParams.z, dirX, dirY, dirZ),
                            addParams.metadata
                        );
                        const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
                        await ObjectManager.spawnObject(gameObject);

                        if (gameObject instanceof CanvasGameObject)
                            await (gameObject as CanvasGameObject).loadImage();
                    }
                    break;
                }
                case PERSISTENT_OBJ_TASK_TYPE_REMOVE:
                {
                    const removeParams = task as RemovePersistentObjectParams;
                    const removed = removePersistentObject(room, removeParams.objectId);
                    if (removed)
                    {
                        // If the removed object was selected, unselect it.
                        const sel = persistentObjectSelectionObservable.peek();
                        if (sel && sel.gameObject.params.objectId === removeParams.objectId)
                            persistentObjectSelectionObservable.set(null);

                        await ObjectManager.despawnObject(removeParams.objectId);
                    }
                    break;
                }
                case PERSISTENT_OBJ_TASK_TYPE_MOVE:
                {
                    const moveParams = task as MovePersistentObjectParams;
                    const oldObjectId = moveParams.objectId;
                    const po = movePersistentObject(room, oldObjectId, moveParams.dx, moveParams.dy);
                    if (po)
                    {
                        // Despawn old, respawn at new position (direction may have changed due to corner wrapping)
                        const existingObj = ObjectManager.getObjectById(oldObjectId);
                        if (existingObj)
                        {
                            await ObjectManager.despawnObject(oldObjectId);

                            const {dirX, dirY, dirZ} = directionStringToVector(po.direction);
                            const objectSpawnParams = new ObjectSpawnParams(
                                room.id, "", "", po.objectTypeIndex,
                                po.objectId,
                                new ObjectTransform(po.x, po.y, po.z, dirX, dirY, dirZ),
                                po.metadata
                            );
                            const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
                            await ObjectManager.spawnObject(gameObject);

                            if (gameObject instanceof CanvasGameObject)
                                await (gameObject as CanvasGameObject).loadImage();

                            // If the moved object was selected by us, deactivate the selection
                            // since another user initiated the move.
                            const sel = persistentObjectSelectionObservable.peek();
                            if (sel && sel.gameObject.params.objectId === oldObjectId)
                                persistentObjectSelectionObservable.set(null);
                        }
                    }
                    break;
                }
                case PERSISTENT_OBJ_TASK_TYPE_SET_METADATA:
                {
                    const metaParams = task as SetPersistentObjectMetadataParams;
                    const po = setPersistentObjectMetadata(room, metaParams.objectId,
                        metaParams.metadataKey, metaParams.metadataValue);
                    if (po)
                    {
                        // Update the game object's metadata
                        const gameObject = ObjectManager.getObjectById(metaParams.objectId);
                        if (gameObject)
                        {
                            gameObject.params.setMetadata(metaParams.metadataKey, metaParams.metadataValue);

                            // If it's a canvas and the image URL changed, reload the image
                            if (gameObject instanceof CanvasGameObject)
                                await (gameObject as CanvasGameObject).loadImage();
                        }

                        // If the modified object was selected by us, deactivate the selection
                        // since another user initiated the metadata change.
                        const sel = persistentObjectSelectionObservable.peek();
                        if (sel && sel.gameObject.params.objectId === metaParams.objectId)
                            persistentObjectSelectionObservable.set(null);
                    }
                    break;
                }
                default:
                    console.error(`Unknown persistent object task type :: ${task.type}`);
                    break;
            }
        }
    },
}

const waitUntilSignalProcessingReady = (signalType: string, successCond: () => boolean): Promise<boolean> =>
    AsyncUtil.waitUntilSuccess(successCond, SignalTypeConfigMap.getConfigByType(signalType).maxClientSideReceptionPeriod)

export default PersistentObjectManager;
