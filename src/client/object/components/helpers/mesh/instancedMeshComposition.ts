import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import SetObjectMetadataSignal from "../../../../../shared/object/types/setObjectMetadataSignal";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ClientObjectManager from "../../../clientObjectManager";
import GameObject from "../../../types/gameObject";
import InstancedMeshCompositionPart from "../../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import { InstancedMeshCompositionCodecMap } from "../../../../../shared/graphics/mesh/composition/maps/instancedMeshCompositionCodecMap";
import StringUtil from "../../../../../shared/math/util/stringUtil";
import { InstancedMeshCompositionCodecType, InstancedMeshCompositionCodecTypeEnumMap } from "../../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { InstancedMeshCompositionParams } from "../../../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";

export default class InstancedMeshComposition
{
    codecType: InstancedMeshCompositionCodecType = InstancedMeshCompositionCodecTypeEnumMap.Default;
    codecVersion: number = 0;
    params: InstancedMeshCompositionParams = {};
    parts: InstancedMeshCompositionPart[] = [];

    constructor(codecType: InstancedMeshCompositionCodecType, codecVersion: number)
    {
        this.codecType = codecType;
        this.codecVersion = codecVersion;
    }

    saveToMetadata(gameObject: GameObject)
    {
        const metadata = `${this.getCodecPrefix()}${this.encodeParts()}`;

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
        this.params = {};
        this.parts.length = 0;
        let metadata = gameObject.params.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];
        if (!metadata)
        {
            const config = gameObject.components.instancedMeshComposer.componentConfig;
            const {params, parts} = config.generateDefaultParts(gameObject.params.sourceUserID);
            this.params = params;
            this.parts = parts;
            return;
        }

        const codecType = StringUtil.convertVisibleASCIIToRawNumber(metadata.str, 0, 0);
        if (this.codecType != codecType)
        {
            console.error(`CodecType mismatch (expected: ${this.codecType}, decoded: ${codecType})`);
        }
        const codecVersion = StringUtil.convertVisibleASCIIToRawNumber(metadata.str, 1, 0);
        if (this.codecVersion != codecVersion)
        {
            console.error(`CodecVersion mismatch (expected: ${this.codecVersion}, decoded: ${codecVersion})`);
        }
        InstancedMeshCompositionCodecMap[codecType].decode(metadata.str, this.params, this.parts);
    }

    // Encodes the current parts into their encoded-parameters form: a string holding
    // one visible-ASCII character per quantized parameter (without the codec type/version prefix).
    encodeParts(): string
    {
        return InstancedMeshCompositionCodecMap[this.codecType].encode(this.params, this.parts);
    }

    // Rebuilds all the parts from the current params, by round-tripping them through
    // the codec (which guarantees that the parts match what will be persisted).
    rebuildParts()
    {
        this.decodeParts(this.encodeParts());
    }

    // Rebuilds all the parts from the given encoded parameters (see "encodeParts").
    decodeParts(encodedParams: string)
    {
        this.parts.length = 0;
        InstancedMeshCompositionCodecMap[this.codecType].decode(
            `${this.getCodecPrefix()}${encodedParams}`, this.params, this.parts);
    }

    // The prefix consists of two characters, denoting the codec's type and version, respectively.
    private getCodecPrefix(): string
    {
        return StringUtil.convertRawNumberToVisibleASCII(this.codecType)
            + StringUtil.convertRawNumberToVisibleASCII(this.codecVersion);
    }
}