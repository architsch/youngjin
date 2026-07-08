import InstancedMeshCompositionPart from "../instancedMeshCompositionPart";

export default interface InstancedMeshCompositionCodec
{
    encode: (encodeInput: InstancedMeshCompositionPart[]) => string;
    decode: (strToDecode: string, decodeOutput: InstancedMeshCompositionPart[]) => void;
    getRandomComposition: (seed: number) => InstancedMeshCompositionPart[];
}