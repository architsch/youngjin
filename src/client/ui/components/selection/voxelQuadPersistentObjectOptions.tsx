import { useEffect, useState } from "react";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import Button from "../basic/button";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ObjectTypeConfigMap from "../../../../shared/object/maps/objectTypeConfigMap";
import AddPersistentObjectParams from "../../../../shared/object/types/update/addPersistentObjectParams";
import { getVoxelQuadTransformDimensions } from "../../../../shared/voxel/util/voxelQueryUtil";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import EncodableByteString from "../../../../shared/networking/types/encodableByteString";
import { notificationMessageObservable, persistentObjectAddPendingObservable, voxelQuadSelectionObservable } from "../../../system/clientObservables";
import CanvasGameObject from "../../../object/types/canvasGameObject";
import { MAX_CANVASES_PER_ROOM, MID_ROOM_Y } from "../../../../shared/system/sharedConstants";
import { showWorldSpaceSpinner } from "../../../graphics/types/gizmo/worldSpaceSpinner";

const canvasTypeIndex = ObjectTypeConfigMap.getIndexByType("Canvas");

export default function VoxelQuadPersistentObjectOptions(props: {selection: VoxelQuadSelection})
{
    const [pending, setPending] = useState(persistentObjectAddPendingObservable.peek());

    useEffect(() => {
        persistentObjectAddPendingObservable.addListener("ui.voxelQuadPersistentObjectOptions", setPending);
        return () => { persistentObjectAddPendingObservable.removeListener("ui.voxelQuadPersistentObjectOptions"); };
    }, []);

    return <div className="flex flex-col gap-2 p-2 w-fit pointer-events-auto overflow-hidden bg-black">
        <div className="flex flex-row gap-2">
            <Button name="Add Canvas" size="sm" disabled={pending} onClick={() => {
                addPersistentObjectFromQuad(props.selection, canvasTypeIndex,
                    {[ObjectMetadataKeyEnumMap.ImageURL]: new EncodableByteString("")});
            }}/>
        </div>
    </div>;
}

function addPersistentObjectFromQuad(selection: VoxelQuadSelection,
    objectTypeIndex: number, metadata: {[key: number]: EncodableByteString})
{
    const room = App.getCurrentRoom();
    if (!room)
        return;

    if (objectTypeIndex === canvasTypeIndex
        && CanvasGameObject.spawnedCanvasGameObjects.size >= MAX_CANVASES_PER_ROOM)
    {
        notificationMessageObservable.set(`Cannot add more than ${MAX_CANVASES_PER_ROOM} canvases per room.`);
        return;
    }

    const voxel = selection.voxel;
    const quadIndex = selection.quadIndex;
    const { offsetX, offsetY, offsetZ, dirX, dirY, dirZ } =
        getVoxelQuadTransformDimensions(voxel, quadIndex);

    if (dirY != 0) // A canvas cannot be added to a voxelQuad which is either looking up (+y) or down (-y).
    {
        notificationMessageObservable.set("You can only add a canvas to a wall!");
        return;
    }

    if (persistentObjectAddPendingObservable.peek())
        return;

    const x = voxel.col + 0.5 + offsetX;
    const y = 0.5 * (offsetY < MID_ROOM_Y ? Math.ceil(2 * offsetY) : Math.floor(2 * offsetY));
    const z = voxel.row + 0.5 + offsetZ;

    let direction: "+z" | "+x" | "-z" | "-x" = "+z";
    if (dirX > 0) direction = "+x";
    else if (dirX < 0) direction = "-x";
    else if (dirZ > 0) direction = "+z";
    else if (dirZ < 0) direction = "-z";

    VoxelQuadSelection.unselect();
    persistentObjectAddPendingObservable.set(true);
    showWorldSpaceSpinner(x, y, z, dirX, dirY, dirZ, () => persistentObjectAddPendingObservable.set(false));

    const dirNum = AddPersistentObjectParams.directionStringToNumber(direction);
    SocketsClient.emitUpdatePersistentObjectGroup(
        new AddPersistentObjectParams(objectTypeIndex, dirNum, x, y, z, metadata));
}
