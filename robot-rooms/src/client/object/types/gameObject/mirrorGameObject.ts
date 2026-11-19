import * as THREE from "three";
import GameObject from "./gameObject";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import InstancedMeshGraphics from "../../components/instancedMeshGraphics";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import MirrorObjectTypeConfig, { MIRROR_COLOR_PALETTE_NAME } from "../../../../shared/object/types/objectTypeConfig/mirrorObjectTypeConfig";
import ObjectCategoryConfigMap from "../../../../shared/object/maps/objectCategoryConfigMap";
import ColorUtil from "../../../../shared/math/util/colorUtil";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";
import InstancedMirrorMaterialParams from "../../../../shared/graphics/material/types/instancedMirrorMaterialParams";
import MeshDataUtil from "../../../../shared/graphics/mesh/util/meshDataUtil";
import FramedPanelCompositionConstants, { FRAMED_PANEL_BOARD_RELIEF, FRAMED_PANEL_CONTENT_LIFT,
    FRAMED_PANEL_GEOMETRY_ID } from "../../../../shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import FramedPanelCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/framedPanelCompositionParams";
import { BACKWARD_DIR } from "../../../../shared/system/sharedConstants";
import MeshFactory from "../../../graphics/factories/meshFactory";
import MirrorReflectionUtil from "../../../graphics/util/mirrorReflectionUtil";
import MirrorMaterialUtil from "../../../graphics/util/mirrorMaterialUtil";

const glassMaterialParams = new InstancedMirrorMaterialParams();
const glassInstancedMeshId = MeshDataUtil.getInstancedMeshId(FRAMED_PANEL_GEOMETRY_ID,
    glassMaterialParams.getMaterialId());

// A mirror: its frame is composed from its look, as a canvas's is (see FramedPanelCompositionCodec), and its glass fills
// the board inside the band, or the whole footprint when there is no frame, showing the room reflected (see
// MirrorReflectionUtil) under its surface.
export default class MirrorGameObject extends GameObject
{
    private instancedMeshGraphics: InstancedMeshGraphics;
    private instancedMeshComposer: InstancedMeshComposer;

    private instanceId: number = -1;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("MirrorGameObject requires InstancedMeshGraphics component");
        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("MirrorGameObject requires InstancedMeshComposer component");
    }

    async onSpawn(): Promise<void>
    {
        // A frame change resizes the glass without resizing the mirror.
        this.instancedMeshComposer.partsRebuiltObservable.addListener("mirrorGameObject", () => this.placeGlass());
        await super.onSpawn();

        await this.instancedMeshGraphics.loadInstancedMesh(FRAMED_PANEL_GEOMETRY_ID, glassMaterialParams,
            ObjectCategoryConfigMap.getMaxCountPerRoom(this.config.category), true);
        // An exhausted pool (a mirror still going as another comes) leaves this one's glass undrawn.
        const rentedInstanceId = this.instancedMeshGraphics.rentInstanceFromPool(glassInstancedMeshId);
        if (rentedInstanceId == undefined)
            return;
        this.instanceId = rentedInstanceId;
        this.placeGlass();
        this.applySurface();
        MirrorReflectionUtil.setGlass(MeshFactory.getMesh(glassInstancedMeshId) as THREE.InstancedMesh, this.instanceId);
    }

    async onDespawn(): Promise<void>
    {
        this.instancedMeshComposer.partsRebuiltObservable.removeListener("mirrorGameObject");
        await super.onDespawn();

        // -1 if it never got an instance.
        if (this.instanceId !== -1)
        {
            MirrorReflectionUtil.setGlass(undefined);
            this.instancedMeshGraphics.returnInstanceToPool(glassInstancedMeshId, this.instanceId);
        }
        this.instanceId = -1;
    }

    onTransformChanged(resized: boolean): void
    {
        super.onTransformChanged(resized);
        this.placeGlass();
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.MirrorProperties)
            this.applySurface();
    }

    forEachOwnedInstance(visit: (instancedMeshId: string, instanceId: number) => void)
    {
        if (this.instanceId !== -1)
            visit(glassInstancedMeshId, this.instanceId);
    }

    // On its face in front of the board, as a canvas's picture is (see PictureGameObject), over what the frame leaves
    // of the footprint.
    private placeGlass(): void
    {
        if (this.instanceId === -1)
            return;
        const glassSize = FramedPanelCompositionConstants.getInnerSize(
            this.instancedMeshComposer.getParams() as FramedPanelCompositionParams,
            ObjectScaleUtil.getObjectSize(this.params.objectTypeIndex, this.params.transform.scale));
        this.instancedMeshGraphics.updateInstanceTransform(glassInstancedMeshId, this.instanceId,
            0, 0, FRAMED_PANEL_BOARD_RELIEF + FRAMED_PANEL_CONTENT_LIFT, BACKWARD_DIR.x, BACKWARD_DIR.y, BACKWARD_DIR.z,
            glassSize.x, glassSize.y, glassSize.z);
    }

    // Its color and opacity over the reflection, which are the glass's (a room holds one mirror at most).
    private applySurface(): void
    {
        if (this.instanceId === -1)
            return;
        const color = ColorUtil.paletteIndexToRGB(MIRROR_COLOR_PALETTE_NAME,
            MirrorObjectTypeConfig.util.getColorIndex(this.params));
        MirrorMaterialUtil.setSurface(color.x, color.y, color.z, MirrorObjectTypeConfig.util.getOpacity(this.params));
    }
}
