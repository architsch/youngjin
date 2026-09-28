import PictureGameObject from "./pictureGameObject";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import FramedPanelCompositionConstants from "../../../../shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import FramedPanelCompositionParams from "../../../../shared/graphics/mesh/composition/types/compositionParams/framedPanelCompositionParams";
import Vec3 from "../../../../shared/math/types/vec3";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";

// A painting: its frame is composed from the canvas's look (see FramedPanelCompositionCodec), and its picture
// fills the board inside the band, or the whole footprint when there is no frame (see
// FramedPanelCompositionConstants).
export default class CanvasGameObject extends PictureGameObject
{
    instancedMeshComposer: InstancedMeshComposer;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("CanvasGameObject requires InstancedMeshComposer component");
    }

    async onSpawn(): Promise<void>
    {
        // A frame change resizes the picture without resizing the canvas.
        this.instancedMeshComposer.partsRebuiltObservable.addListener("canvasGameObject",
            () => this.updatePicture());
        await super.onSpawn();
    }

    async onDespawn(): Promise<void>
    {
        this.instancedMeshComposer.partsRebuiltObservable.removeListener("canvasGameObject");
        await super.onDespawn();
    }

    protected getPictureSize(): Vec3
    {
        return FramedPanelCompositionConstants.getInnerSize(
            this.instancedMeshComposer.getParams() as FramedPanelCompositionParams,
            ObjectScaleUtil.getObjectSize(this.params.objectTypeIndex, this.params.transform.scale));
    }
}
