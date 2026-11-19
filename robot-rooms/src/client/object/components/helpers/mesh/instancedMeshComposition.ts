import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import SetObjectMetadataSignal from "../../../../../shared/object/types/setObjectMetadataSignal";
import { RoomTypeEnumMap } from "../../../../../shared/room/types/roomType";
import App from "../../../../app";
import SocketsClient from "../../../../networking/client/socketsClient";
import ClientObjectManager from "../../../clientObjectManager";
import GameObject from "../../../types/gameObject/gameObject";
import InstancedMeshCompositionPart from "../../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionPart";
import { InstancedMeshCompositionCodecMap } from "../../../../../shared/graphics/mesh/composition/maps/instancedMeshCompositionCodecMap";
import CompositionMetadataUtil from "../../../../../shared/graphics/mesh/composition/util/compositionMetadataUtil";
import { InstancedMeshCompositionCodecType, InstancedMeshCompositionCodecTypeEnumMap } from "../../../../../shared/graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import { InstancedMeshCompositionParams } from "../../../../../shared/graphics/mesh/composition/types/compositionParams/instancedMeshCompositionParams";
import Vec3 from "../../../../../shared/math/types/vec3";
import ObjectCompositionUtil from "../../../../../shared/object/util/objectCompositionUtil";
import ObjectScaleUtil from "../../../../../shared/object/util/objectScaleUtil";
import { UNIT_VEC3 } from "../../../../../shared/system/sharedConstants";

export default class InstancedMeshComposition
{
    codecType: InstancedMeshCompositionCodecType = InstancedMeshCompositionCodecTypeEnumMap.Default;
    codecVersion: number = 0;
    params: InstancedMeshCompositionParams = {};
    parts: InstancedMeshCompositionPart[] = [];
    // The footprint the current parts were built for (see InstancedMeshCompositionCodec).
    objectSize: Vec3 = {...UNIT_VEC3};

    // Bumped every time the parts are rebuilt. Anything that reads them across an await compares this
    // to tell a composition it is still working on from one that has since been replaced. Counted here,
    // beside the array, so no rebuild can forget to (unrelated to codecVersion, which is the format).
    revision: number = 0;

    constructor(codecType: InstancedMeshCompositionCodecType, codecVersion: number)
    {
        this.codecType = codecType;
        this.codecVersion = codecVersion;
    }

    saveToMetadata(gameObject: GameObject)
    {
        const metadata = `${this.getCodecPrefix()}${this.encodeParts()}`;
        const objectId = gameObject.params.objectId;
        const key = ObjectMetadataKeyEnumMap.InstancedMeshComposition;

        const room = App.getCurrentRoom();
        if (!room)
        {
            console.error("InstancedMeshComposition.saveToMetadata :: Current room not found");
            return;
        }
        if (room.roomType == RoomTypeEnumMap.SinglePlayer)
        {
            ClientObjectManager.setObjectMetadata(objectId, key, metadata, false);
            return;
        }
        // Applied here as well, since the server passes an edit on to everyone but its sender.
        if (ClientObjectManager.setObjectMetadata(objectId, key, metadata))
            SocketsClient.emitSetObjectMetadataSignal(new SetObjectMetadataSignal(room.id, objectId, key, metadata));
    }

    // Params and parts are refilled in place (not replaced), so a panel holding them (see
    // CustomizePlayerPanel) keeps editing the live composition after a save round-trips as metadata.
    loadFromMetadata(gameObject: GameObject)
    {
        for (const key in this.params)
            delete this.params[key];
        this.parts.length = 0;
        ++this.revision;
        this.objectSize = getObjectSize(gameObject);
        ObjectCompositionUtil.decode(gameObject.params, this.params, this.parts);
    }

    // One visible-ASCII char per quantized parameter, without the codec prefix.
    encodeParts(): string
    {
        return InstancedMeshCompositionCodecMap[this.codecType].encode(this.params, this.parts);
    }

    // Rebuilds all the parts from the given encoded parameters (see "encodeParts"), at the object's
    // current size.
    decodeParts(encodedParams: string, gameObject: GameObject)
    {
        this.parts.length = 0;
        ++this.revision;
        this.objectSize = getObjectSize(gameObject);
        InstancedMeshCompositionCodecMap[this.codecType].decode(
            `${this.getCodecPrefix()}${encodedParams}`, this.objectSize, this.params, this.parts);
        ObjectCompositionUtil.deriveParts(gameObject.params, this.parts);
    }

    // The prefix consists of two characters, denoting the codec's type and version, respectively.
    private getCodecPrefix(): string
    {
        return CompositionMetadataUtil.getCodecPrefix(this.codecType, this.codecVersion);
    }
}

// Kept with the parts, so the composer can tell a resize from a move (see InstancedMeshComposer).
function getObjectSize(gameObject: GameObject): Vec3
{
    return ObjectScaleUtil.getObjectSize(gameObject.params.objectTypeIndex, gameObject.params.transform.scale);
}
