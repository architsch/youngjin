import { useCallback } from "react";
import { voxelQuadSelectionObservable } from "../../../system/clientObservables";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import AtlasCellSprite from "../basic/atlasCellSprite";
import { enableHorizontalDragScroll } from "../../util/mouseScroll";
import GameSocketsClient from "../../../networking/client/gameSocketsClient";
import SetVoxelQuadTextureParams from "../../../../shared/voxel/types/update/setVoxelQuadTextureParams";
import App from "../../../app";
import VoxelMeshInstancer from "../../../object/components/voxelMeshInstancer";
import { setVoxelQuadVisible } from "../../../../shared/voxel/util/voxelQuadUpdateUtil";
import { getVoxelQuadCollisionLayerFromQuadIndex, getVoxelQuadFacingAxisFromQuadIndex, getVoxelQuadOrientationFromQuadIndex } from "../../../../shared/voxel/util/voxelQueryUtil";

export default function VoxelQuadTextureOptions(props: {selection: VoxelQuadSelection})
{
    const onRefChange = useCallback((node: any) => {
        if (node)
            enableHorizontalDragScroll(node as HTMLElement);
    }, []);

    const quadIndex = props.selection.quadIndex;
    const selectedTextureIndex = App.getVoxelQuads()[quadIndex] & 0b01111111;

    const materialParams = VoxelMeshInstancer.latestMaterialParams;
    const numCols = materialParams.textureWidth / materialParams.textureGridCellWidth;
    const numRows = materialParams.textureHeight / materialParams.textureGridCellHeight;
    const selectedTextureCol = selectedTextureIndex % numCols;
    const selectedTextureRow = Math.floor(selectedTextureIndex / numCols);

    const textureIndices = new Array<number>(numRows * numCols);
    for (let textureIndex = 0; textureIndex < textureIndices.length; ++textureIndex)
        textureIndices[textureIndex] = textureIndex;

    const additionalClassNames = "min-h-14 max-h-14 sm:min-h-13 sm:max-h-13 md:min-h-12 md:max-h-12 lg:min-h-11 lg:max-h-11";

    return <div ref={onRefChange} className="flex flex-row gap-2 p-2 w-full overflow-x-auto no-scrollbar pointer-events-auto bg-black">
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

                const facingAxis = getVoxelQuadFacingAxisFromQuadIndex(quadIndex);
                const orientation = getVoxelQuadOrientationFromQuadIndex(quadIndex);
                const collisionLayer = getVoxelQuadCollisionLayerFromQuadIndex(quadIndex);

                if (setVoxelQuadVisible(true, props.selection.voxel, facingAxis, orientation,
                    collisionLayer, textureIndex))
                {
                    voxelQuadSelectionObservable.notify();
                    GameSocketsClient.emitSetVoxelQuadTexture(new SetVoxelQuadTextureParams(quadIndex, textureIndex));
                }
            };
            return <AtlasCellSprite
                key={`texture.select.${textureIndex}`}
                atlasImageURL={materialParams.textureId}
                atlasWidth={materialParams.textureWidth}
                atlasHeight={materialParams.textureHeight}
                atlasCellWidth={materialParams.textureGridCellWidth}
                atlasCellHeight={materialParams.textureGridCellHeight}
                atlasCellCol={col}
                atlasCellRow={row}
                highlight={col == selectedTextureCol && row == selectedTextureRow}
                autoScrollToHighlight={true}
                additionalClassNames={additionalClassNames}
                onClick={onClick}
            />})
        }
    </div>;
}