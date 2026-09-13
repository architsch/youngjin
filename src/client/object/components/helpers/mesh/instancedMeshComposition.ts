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
import CompositionMetadataUtil from "../../../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
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

    // Params and parts are refilled in place (not replaced), so a panel holding them (see
    // CustomizePlayerPanel) keeps editing the live composition after a save round-trips as metadata.
    loadFromMetadata(gameObject: GameObject)
    {
        for (const key in this.params)
            delete this.params[key];
        this.parts.length = 0;
        const metadata = gameObject.params.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];
        if (!metadata || !this.canDecode(metadata.str))
        {
            const config = gameObject.components.instancedMeshComposer.componentConfig;
            const {params, parts} = config.generateDefaultParts(gameObject.params);
            Object.assign(this.params, params);
            for (let i = 0; i < parts.length; ++i)
                this.parts.push(parts[i]);
            return;
        }
        InstancedMeshCompositionCodecMap[this.codecType].decode(metadata.str, this.params, this.parts);
    }

    private canDecode(str: string): boolean
    {
        const codecType = StringUtil.convertVisibleASCIIToRawNumber(str, 0, 0);
        if (codecType != this.codecType || !InstancedMeshCompositionCodecMap[codecType])
        {
            console.error(`InstancedMeshComposition::canDecode :: CodecType mismatch (expected: ${this.codecType}, decoded: ${codecType})`);
            return false;
        }
        const codecVersion = StringUtil.convertVisibleASCIIToRawNumber(str, 1, 0);
        if (codecVersion != this.codecVersion)
        {
            // Codecs are expected to migrate outdated versions inside decode.
            console.warn(`InstancedMeshComposition::canDecode :: CodecVersion mismatch (expected: ${this.codecVersion}, decoded: ${codecVersion}). An automatic version migration logic should run.`);
        }
        return true;
    }

    // One visible-ASCII char per quantized parameter, without the codec prefix.
    encodeParts(): string
    {
        return InstancedMeshCompositionCodecMap[this.codecType].encode(this.params, this.parts);
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
        return CompositionMetadataUtil.getCodecPrefix(this.codecType, this.codecVersion);
    }
}