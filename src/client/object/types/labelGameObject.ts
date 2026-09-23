import GameObject from "./gameObject";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import InstancedMeshComposer from "../components/instancedMeshComposer";
import LabelText from "../components/labelText";
import FramedPanelCompositionConstants from "../../../shared/graphics/mesh/composition/types/compositionConstants/framedPanelCompositionConstants";
import FramedPanelCompositionParams from "../../../shared/graphics/mesh/composition/types/compositionParams/framedPanelCompositionParams";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";

// Text on a plaque (see LabelCompositionCodec), kept inside the plaque's band: the text fills the patch
// its LabelText is configured with, narrowed to what the frame leaves inside it.
export default class LabelGameObject extends GameObject
{
    private instancedMeshComposer: InstancedMeshComposer;
    private labelText: LabelText;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        if (!this.instancedMeshComposer)
            throw new Error("LabelGameObject requires InstancedMeshComposer component");

        this.labelText = this.components.labelText as LabelText;
        if (!this.labelText)
            throw new Error("LabelGameObject requires LabelText component");
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        // Every decode, including a resize's and a frame edit's, may move the band.
        this.instancedMeshComposer.partsRebuiltObservable.addListener("labelGameObject",
            () => this.fitTextInsideFrame());
        this.fitTextInsideFrame();
    }

    async onDespawn(): Promise<void>
    {
        this.instancedMeshComposer.partsRebuiltObservable.removeListener("labelGameObject");
        await super.onDespawn();
    }

    private fitTextInsideFrame()
    {
        this.labelText.setContentSize(FramedPanelCompositionConstants.getInnerSize(
            this.instancedMeshComposer.getParams() as FramedPanelCompositionParams,
            ObjectScaleUtil.getObjectSize(this.params.objectTypeIndex, this.params.transform.scale)));
    }
}
