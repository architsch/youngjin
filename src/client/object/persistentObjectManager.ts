import * as THREE from "three";
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
import PersistentObjectUpdateUtil from "../../shared/object/util/persistentObjectUpdateUtil";
import { PERSISTENT_OBJ_TASK_TYPE_ADD, PERSISTENT_OBJ_TASK_TYPE_MOVE, PERSISTENT_OBJ_TASK_TYPE_REMOVE, PERSISTENT_OBJ_TASK_TYPE_SET_METADATA } from "../../shared/system/sharedConstants";
import AsyncUtil from "../../shared/system/util/asyncUtil";
import SignalTypeConfigMap from "../../shared/networking/maps/signalTypeConfigMap";
import { persistentObjectSelectionObservable } from "../system/clientObservables";
import CanvasGameObject from "./types/canvasGameObject";
import WorldSpaceSpinner from "../graphics/types/gizmo/worldSpaceSpinner";
import PersistentObjectSelection from "../graphics/types/gizmo/persistentObjectSelection";
import DirUtil from "../../shared/math/util/dirUtil";

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

                    // Empty objectId means the server rejected the ADD request.
                    // Skip object creation but still clear the pending state below.
                    if (addParams.objectId && addParams.objectId.length > 0)
                    {
                        const po = PersistentObjectUpdateUtil.addPersistentObject(room, addParams.objectTypeIndex,
                            addParams.dir, addParams.x, addParams.y, addParams.z, addParams.metadata,
                            addParams.objectId);
                        if (po)
                        {
                            const dirVec = DirUtil.dir4ToVec3(addParams.dir);
                            const objectSpawnParams = new ObjectSpawnParams(
                                room.id, "", "", addParams.objectTypeIndex,
                                po.objectId,
                                new ObjectTransform(addParams.x, addParams.y, addParams.z, dirVec.x, dirVec.y, dirVec.z),
                                addParams.metadata
                            );
                            const gameObject = ObjectFactory.createServerSideObject(objectSpawnParams);
                            await ObjectManager.spawnObject(gameObject);

                            if (gameObject instanceof CanvasGameObject)
                                await (gameObject as CanvasGameObject).loadImage();
                        }
                    }

                    WorldSpaceSpinner.destroySpinner(addParams.x, addParams.y, addParams.z);
                    break;
                }
                case PERSISTENT_OBJ_TASK_TYPE_REMOVE:
                {
                    const removeParams = task as RemovePersistentObjectParams;
                    const removed = PersistentObjectUpdateUtil.removePersistentObject(room, removeParams.objectId);
                    if (removed)
                    {
                        // If the removed object was selected, unselect it.
                        const sel = persistentObjectSelectionObservable.peek();
                        if (sel && sel.gameObject.params.objectId === removeParams.objectId)
                            PersistentObjectSelection.unselect();

                        await ObjectManager.despawnObject(removeParams.objectId);
                    }
                    break;
                }
                case PERSISTENT_OBJ_TASK_TYPE_MOVE:
                {
                    const moveParams = task as MovePersistentObjectParams;
                    const objectId = moveParams.objectId;
                    const po = PersistentObjectUpdateUtil.movePersistentObject(room, objectId, moveParams.dx, moveParams.dy, moveParams.dz);
                    if (po)
                    {
                        const existingObj = ObjectManager.getObjectById(objectId);
                        if (existingObj)
                        {
                            existingObj.forceSetPosition(new THREE.Vector3(po.x, po.y, po.z));

                            const dirVec = DirUtil.dir4ToVec3(po.dir);
                            existingObj.obj.lookAt(new THREE.Vector3(
                                po.x + dirVec.x, po.y + dirVec.y, po.z + dirVec.z
                            ));

                            // If the moved object was selected by us, deactivate the selection
                            // since another user initiated the move.
                            const sel = persistentObjectSelectionObservable.peek();
                            if (sel && sel.gameObject.params.objectId === objectId)
                                PersistentObjectSelection.unselect();
                        }
                        else
                            console.error(`Tried to move a persistentObject, but its object instance is not found (objectId = ${objectId})`);
                    }
                    break;
                }
                case PERSISTENT_OBJ_TASK_TYPE_SET_METADATA:
                {
                    const metaParams = task as SetPersistentObjectMetadataParams;
                    const po = PersistentObjectUpdateUtil.setPersistentObjectMetadata(room, metaParams.objectId,
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
                            PersistentObjectSelection.unselect();
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
