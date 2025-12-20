import { useCallback } from "react";
import { voxelQuadSelectionObservable } from "../../../system/observables";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import AtlasCellSprite from "../basic/atlasCellSprite";
import { enableHorizontalDragScroll } from "../../util/mouseScroll";
import GameSocketsClient from "../../../networking/gameSocketsClient";
import VoxelTextureChangeParams from "../../../../shared/voxel/types/voxelTextureChangeParams";
import VoxelManager from "../../../voxel/voxelManager";
import App from "../../../app";

export default function VoxelQuadTextureOptions(props: {selection: VoxelQuadSelection})
{
    const onRefChange = useCallback((node: any) => {
        if (node)
            enableHorizontalDragScroll(node as HTMLElement);
    }, []);

    const selectedVoxel = props.selection.voxel;
    const selectedVoxelQuad = props.selection.voxelQuad;
    const selectedQuadIndex = props.selection.quadIndex;
    const selectedTextureIndex = selectedVoxelQuad.textureIndex;

    const materialParams = props.selection.materialParams;
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
                const params = new VoxelTextureChangeParams(selectedVoxel.row, selectedVoxel.col, selectedQuadIndex, textureIndex);
                if (await VoxelManager.changeVoxelTextureOnClientSide(room, params))
                {
                    voxelQuadSelectionObservable.notify();
                    GameSocketsClient.emitVoxelTextureChange(params);
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