import App from "../../app";
import InstancedMeshConfig from "../types/instancedMeshConfig";
import MaterialParams from "../types/material/materialParams";
import TexturePackMaterialParams from "../types/material/texturePackMaterialParams";

export const InstancedMeshConfigMap: {[instancedMeshConfigId: string]: InstancedMeshConfig} =
{
    "Voxel": {
        getMaterialParams: (): MaterialParams =>
        {
            const currentRoom = App.getCurrentRoom();
            if (!currentRoom)
                throw new Error(`Current room not found.`);

            return new TexturePackMaterialParams(currentRoom.texturePackURL,
                1024, 1024, 128, 128, "staticImageFromURL");
        },
        geometryId: "Quad",
        maxNumInstances: 8192,
    },
    "Door": {
        getMaterialParams: (): MaterialParams =>
        {
            return new TexturePackMaterialParams("persistent_object_texture_pack",
                2048, 2048, 256, 256, "dynamicEmpty");
        },
        geometryId: "Quad",
        maxNumInstances: 8192,
    },
}