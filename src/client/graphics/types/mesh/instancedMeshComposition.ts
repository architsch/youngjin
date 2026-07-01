import Vec3 from "../../../../shared/math/types/vec3";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import SetObjectMetadataSignal from "../../../../shared/object/types/setObjectMetadataSignal";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { GEOMETRY_CODE_BY_ID, GEOMETRY_ID_BY_CODE, INSTANCED_COLOR_MATERIAL_ID, MATERIAL_CODE_BY_ID, MATERIAL_ID_BY_CODE } from "../../../../shared/system/sharedConstants";
import StringUtil from "../../../../shared/math/util/stringUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientObjectManager from "../../../object/clientObjectManager";
import GameObject from "../../../object/types/gameObject";
import InstancedMeshBinding from "./instancedMeshBinding";
import InstancedMeshCompositionPart from "./instancedMeshCompositionPart";

export default class InstancedMeshComposition
{
    parts: InstancedMeshCompositionPart[] = [];

    saveToMetadata(gameObject: GameObject)
    {
        const partChars: string[] = [];
        for (let i = 0; i < this.parts.length; ++i)
        {
            const part = this.parts[i];
            const ids = part.instancedMeshId.split("+");
            const geometryId = ids[0];
            const materialId = ids[1];

            partChars.push(StringUtil.getVisibleASCIIByIndex(GEOMETRY_CODE_BY_ID[geometryId]));
            partChars.push(StringUtil.getVisibleASCIIByIndex(MATERIAL_CODE_BY_ID[materialId]));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.dir.x, -1, 1));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.dir.y, -1, 1));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.dir.z, -1, 1));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.x, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.y, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.z, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.x, 0, 2.5));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.y, 0, 2.5));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.z, 0, 2.5));
            if (materialId == INSTANCED_COLOR_MATERIAL_ID)
            {
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.x, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.y, 0, 255));
                partChars.push(StringUtil.convertNumberToVisibleASCII(part.color!.z, 0, 255));
            }

            if (i < this.parts.length-1)
                partChars.push(" ");
        }
        const metadata = partChars.join("");

        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("InstancedMeshComposition.saveToMetadata :: Current room not found");
            return;
        }
        if (room.roomType == RoomTypeEnumMap.SinglePlayer)
        {
            ClientObjectManager.setObjectMetadata(gameObject.params.objectId,
                ObjectMetadataKeyEnumMap.InstancedMeshComposition, metadata, false);
        }
        else
        {
            const params = new SetObjectMetadataSignal(
                room.id, gameObject.params.objectId,
                ObjectMetadataKeyEnumMap.InstancedMeshComposition, metadata);
            SocketsClient.emitSetObjectMetadataSignal(params);
        }
    }

    loadFromMetadata(gameObject: GameObject)
    {
        this.parts.length = 0;
        let metadata = gameObject.params.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];
        if (!metadata)
        {
            const config = gameObject.components.instancedMeshComposer.componentConfig;
            this.parts = config.generateDefaultParts();
            return;
        }

        const partStrs = metadata.str.split(" ");
        for (let i = 0; i < partStrs.length; ++i)
        {
            const partStr = partStrs[i];
            const N = partStr.length;
            let charOffset = 0;

            const geometryId = GEOMETRY_ID_BY_CODE[(charOffset < N) ? partStr.charCodeAt(charOffset)-33 : 0];
            charOffset++;
            const materialId = MATERIAL_ID_BY_CODE[(charOffset < N) ? partStr.charCodeAt(charOffset)-33 : 0];
            charOffset++;
            const instancedMeshId = InstancedMeshBinding.getInstancedMeshId(geometryId, materialId);
            
            const dir: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, -1, 1),
                y: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, -1, 1),
                z: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, -1, 1),
            };
            const offset: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, -1.25, 1.25),
                y: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, -1.25, 1.25),
                z: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, -1.25, 1.25),
            };
            const scale: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, 0, 2.5),
                y: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, 0, 2.5),
                z: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, 0, 2.5),
            };

            if (materialId == INSTANCED_COLOR_MATERIAL_ID)
            {
                const color: Vec3 = {
                    x: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, 0, 255),
                    y: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, 0, 255),
                    z: StringUtil.convertVisibleASCIIToNumber(partStr, charOffset++, 0, 255),
                };
                this.parts.push({instancedMeshId, dir, offset, scale, color});
            }
            else
            {
                this.parts.push({instancedMeshId, dir, offset, scale});
            }
        }
    }
}