import { useCallback, useEffect, useState } from "react";
import { voxelQuadSelectionObservable } from "../../../system/observables";
import VoxelQuadSelection from "../../../graphics/types/gizmo/voxelQuadSelection";
import AtlasCellSprite from "../basic/atlasCellSprite";
import ObjectManager from "../../../object/objectManager";
import VoxelMeshInstancer from "../../../object/components/voxelMeshInstancer";
import { enableHorizontalDragScroll } from "../../util/mouseScroll";
import GameSocketsClient from "../../../networking/gameSocketsClient";
import VoxelTextureChangeParams from "../../../../shared/voxel/types/voxelTextureChangeParams";

export default function VoxelQuadSelectionMenu()
{
    const [state, setState] = useState<VoxelQuadSelectionState>({
        selection: null,
    });

    const onRefChange = useCallback((node: any) => {
        if (node)
            enableHorizontalDragScroll(node as HTMLElement);
    }, []);

    useEffect(() => {
        voxelQuadSelectionObservable.addListener("ui.voxelQuadSelection", selection => setState({selection}));
        return () => {
            voxelQuadSelectionObservable.removeListener("ui.voxelQuadSelection");
        };
    }, []);

    if (state.selection)
    {
        const selectedVoxel = state.selection.voxel;
        const selectedVoxelQuad = state.selection.voxelQuad;
        const selectedQuadIndex = state.selection.quadIndex;

        const selectedGameObject = ObjectManager.getObjectById(selectedVoxel.gameObjectId);
        if (!selectedGameObject)
        {
            console.error(`Selected voxel's gameObject not found (obectId = ${selectedVoxel.gameObjectId})`);
            return null;
        }
        const instancer = selectedGameObject.components.voxelMeshInstancer as VoxelMeshInstancer;
        const instancedMeshGraphics = instancer.instancedMeshGraphics;
        const selectedTextureIndex = selectedVoxelQuad.textureIndex;

        const selectedInstanceId = instancedMeshGraphics.instanceIds[selectedQuadIndex];

        const materialParams = state.selection.materialParams;
        const numCols = materialParams.textureWidth / materialParams.textureGridCellWidth;
        const numRows = materialParams.textureHeight / materialParams.textureGridCellHeight;
        const selectedTextureCol = selectedTextureIndex % numCols;
        const selectedTextureRow = Math.floor(selectedTextureIndex / numCols);

        const textureIndices = new Array<number>(numRows * numCols);
        for (let textureIndex = 0; textureIndex < textureIndices.length; ++textureIndex)
            textureIndices[textureIndex] = textureIndex;

        const additionalClassNames = "min-h-18 max-h-18 sm:min-h-16 sm:max-h-16 md:min-h-14 md:max-h-14 lg:min-h-12 lg:max-h-12";

        return <div ref={onRefChange} className="flex flex-row gap-2 p-2 absolute w-full bottom-0 overflow-x-auto no-scrollbar pointer-events-auto bg-black">
            {textureIndices.map((textureIndex) => {
                const col = textureIndex % numCols;
                const row = Math.floor(textureIndex / numCols);
                const onClick = () => {
                    instancedMeshGraphics.setTextureIndex(selectedInstanceId, textureIndex);
                    selectedVoxelQuad.textureIndex = textureIndex;
                    voxelQuadSelectionObservable.notify();
                    //GameSocketsClient.emitVoxelTextureChange(new VoxelTextureChangeParams(
                    //    row, col, selectedQuadIndex, textureIndex));
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
    else
    {
        return null;
    }
}

interface VoxelQuadSelectionState
{
    selection: VoxelQuadSelection | null;
}