import Vec3 from "../../../../shared/math/types/vec3";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import SetObjectMetadataSignal from "../../../../shared/object/types/setObjectMetadataSignal";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";
import { DIR_VEC_BY_CODE, GEOMETRY_CODE_BY_ID, GEOMETRY_ID_BY_CODE } from "../../../../shared/system/sharedConstants";
import StringUtil from "../../../../shared/system/util/stringUtil";
import App from "../../../app";
import SocketsClient from "../../../networking/client/socketsClient";
import ClientObjectManager from "../../../object/clientObjectManager";
import GameObject from "../../../object/types/gameObject";

export default class InstancedMeshComposition
{
    parts: {geometryId: string, dir: Vec3, offset: Vec3, scale: Vec3, color: Vec3}[] = [];

    saveToMetadata(gameObject: GameObject)
    {
        const partChars: string[] = [];
        for (let i = 0; i < this.parts.length; ++i)
        {
            const part = this.parts[i];

            partChars.push(StringUtil.getVisibleASCIIByIndex(
                GEOMETRY_CODE_BY_ID[part.geometryId]));
            partChars.push(StringUtil.getVisibleASCIIByIndex(
                (part.dir.y != 0)
                    ? (part.dir.y < 0 ? 0 : 1)
                    : ((part.dir.x != 0)
                        ? (part.dir.x < 0 ? 2 : 3)
                        : ((part.dir.z != 0)
                            ? (part.dir.z < 0 ? 4 : 5)
                            : 0))));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.x, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.y, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.offset.z, -1.25, 1.25));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.x, 0, 2.5));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.y, 0, 2.5));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.scale.z, 0, 2.5));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.color.x, 0, 1));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.color.y, 0, 1));
            partChars.push(StringUtil.convertNumberToVisibleASCII(part.color.z, 0, 1));

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
            return;
            // TODO: If the metadata is missing, add one.
        }

        const partStrs = metadata.str.split(" ");
        for (let i = 0; i < partStrs.length; ++i)
        {
            const partStr = partStrs[i];
            const N = partStr.length;

            const geometryId = GEOMETRY_ID_BY_CODE[(0 < N) ? partStr.charCodeAt(0)-33 : 0];
            const dir = DIR_VEC_BY_CODE[(1 < N) ? partStr.charCodeAt(1)-33 : 1];
            const offset: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(partStr, 2, -1.25, 1.25),
                y: StringUtil.convertVisibleASCIIToNumber(partStr, 3, -1.25, 1.25),
                z: StringUtil.convertVisibleASCIIToNumber(partStr, 4, -1.25, 1.25),
            };
            const scale: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(partStr, 5, 0, 2.5),
                y: StringUtil.convertVisibleASCIIToNumber(partStr, 6, 0, 2.5),
                z: StringUtil.convertVisibleASCIIToNumber(partStr, 7, 0, 2.5),
            };
            const color: Vec3 = {
                x: StringUtil.convertVisibleASCIIToNumber(partStr, 8, 0, 1),
                y: StringUtil.convertVisibleASCIIToNumber(partStr, 9, 0, 1),
                z: StringUtil.convertVisibleASCIIToNumber(partStr, 10, 0, 1),
            };

            this.parts.push({geometryId, dir, offset, scale, color});
        }
    }
}