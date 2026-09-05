import { voxelQuadSelectionObservable } from "../../../../system/clientObservables";
import VoxelQuadSelection from "../../../../graphics/types/gizmo/voxelQuadSelection";
import AtlasCellSprite from "../../basic/image/atlasCellSprite";
import SocketsClient from "../../../../networking/client/socketsClient";
import SetVoxelQuadTextureSignal from "../../../../../shared/voxel/types/update/setVoxelQuadTextureSignal";
import App from "../../../../app";
import ClientVoxelManager from "../../../../voxel/clientVoxelManager";
import VoxelGameObject from "../../../../object/types/voxelGameObject";
import useMouseDragScroll from "../../../util/mouseDragScroll";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import VoxelUpdateUtil from "../../../../../shared/voxel/util/voxelUpdateUtil";

export default function VoxelQuadTextureOptions(props: {selection: VoxelQuadSelection})
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");

    const quadIndex = props.selection.quadIndex;
    const selectedTextureIndex = App.getVoxelQuads()[quadIndex] & 0b01111111;

    // Whether this face is one the user may paint at all — it may stand inside a restricted zone,
    // for one (see @docs/gameplay/restricted_zone.md). The strip is turned down as a whole rather
    // than being taken away, so that what the face is currently wearing is still there to be seen,
    // and so that a face going out of reach reads the same way as the buttons above it going out of
    // reach rather than as the menu changing shape.
    const currentRoom = App.getCurrentRoom();
    const disabled = currentRoom == undefined || !VoxelUpdateUtil.canSetVoxelQuadTexture(
        App.getUser(), currentRoom, quadIndex);

    const materialParams = VoxelGameObject.materialParams;
    if (!materialParams)
        return null;
    const numCols = materialParams.textureWidth / materialParams.textureGridCellWidth;
    const numRows = materialParams.textureHeight / materialParams.textureGridCellHeight;
    const selectedTextureCol = selectedTextureIndex % numCols;
    const selectedTextureRow = Math.floor(selectedTextureIndex / numCols);

    const textureIndices = new Array<number>(numRows * numCols);
    for (let textureIndex = 0; textureIndex < textureIndices.length; ++textureIndex)
        textureIndices[textureIndex] = textureIndex;

    const additionalClassNames = "min-h-14 max-h-14 sm:min-h-13 sm:max-h-13 md:min-h-12 md:max-h-12 lg:min-h-11 lg:max-h-11"
        + (disabled ? " cursor-not-allowed" : "");

    // Dimmed rather than made unclickable outright, so that the strip can still be scrolled through
    // and read. The refusal is stated as well as drawn, for the same reason IconButton states it.
    return <div id="voxelQuadTextureOptions" ref={onRefChange} aria-disabled={disabled}
        className={`flex flex-row gap-2 p-2 w-full overflow-x-auto no-scrollbar pointer-events-auto bg-gray-800 rounded-md yj-surface-convex ${disabled ? "opacity-50" : ""}`}>
        {textureIndices.map((textureIndex) => {
            const col = textureIndex % numCols;
            const row = Math.floor(textureIndex / numCols);
            const onClick = async () => {
                const room = App.getCurrentRoom();
                if (!room)
                {
                    console.error("Current room not found.");
                    return;
                }

                if (ClientVoxelManager.setVoxelQuadTexture(room, quadIndex, textureIndex))
                {
                    voxelQuadSelectionObservable.notify();

                    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
                        SocketsClient.emitSetVoxelQuadTextureSignal(new SetVoxelQuadTextureSignal(room.id, quadIndex, textureIndex));
                }
            };
            return <AtlasCellSprite
                key={`voxelQuadTexture.select.${textureIndex}`}
                atlasImageURL={materialParams.texturePath}
                atlasWidth={materialParams.textureWidth}
                atlasHeight={materialParams.textureHeight}
                atlasCellWidth={materialParams.textureGridCellWidth}
                atlasCellHeight={materialParams.textureGridCellHeight}
                atlasCellCol={col}
                atlasCellRow={row}
                flipRow={true}
                highlight={col == selectedTextureCol && row == selectedTextureRow}
                autoScrollToHighlight={true}
                additionalClassNames={additionalClassNames}
                onClick={disabled ? undefined : onClick}
            />})
        }
    </div>;
}
