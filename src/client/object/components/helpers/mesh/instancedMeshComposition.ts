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

    // Both the params and the parts are emptied and refilled in place rather than replaced, so that
    // whoever is already holding on to either of them goes on holding the live composition. A form
    // editing the params directly (see CustomizePlayerForm) is what this is for: a composition is
    // reloaded here whenever it is saved, since the save writes it to the object's metadata and
    // comes straight back as a metadata change, and swapping the object out from under such a form
    // would leave its next edit written to a copy nothing reads any more.
    loadFromMetadata(gameObject: GameObject)
    {
        for (const key in this.params)
            delete this.params[key];
        this.parts.length = 0;
        const metadata = gameObject.params.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];
        if (!metadata || !this.canDecode(metadata.str))
        {
            const config = gameObject.components.instancedMeshComposer.componentConfig;
            const {params, parts} = config.generateDefaultParts(gameObject.params.sourceUserID);
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
            // Note: In case of a version number mismatch (which implies that the metadata's
            // format is outdated), an automatic version migration is supposed to run
            // inside the chosen codec's 'decode' method.
            console.warn(`InstancedMeshComposition::canDecode :: CodecVersion mismatch (expected: ${this.codecVersion}, decoded: ${codecVersion}). An automatic version migration logic should run.`);
        }
        return true;
    }

    // Encodes the current parts into their encoded-parameters form: a string holding
    // one visible-ASCII character per quantized parameter (without the codec type/version prefix).
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
        return StringUtil.convertRawNumberToVisibleASCII(this.codecType)
            + StringUtil.convertRawNumberToVisibleASCII(this.codecVersion);
    }
}