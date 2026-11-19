import MaterialParams from "./materialParams";
import { ParticleRenderState } from "../../particle/types/particleRenderState";

// One material per particle batch (see ParticleSystem).
export default class InstancedParticleMaterialParams extends MaterialParams
{
    renderState: ParticleRenderState;

    constructor(renderState: ParticleRenderState)
    {
        super("InstancedParticle");
        this.renderState = renderState;
    }

    protected getDefaultMaterialId(): string
    {
        return `${super.getDefaultMaterialId()}*${this.renderState}`;
    }
}
