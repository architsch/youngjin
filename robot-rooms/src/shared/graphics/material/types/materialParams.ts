export default abstract class MaterialParams
{
    type: string;
    customMaterialId: string | undefined;

    constructor(type: string)
    {
        this.type = type;
        this.customMaterialId = undefined;
    }

    getMaterialId(): string
    {
        return this.customMaterialId ?? this.getDefaultMaterialId();
    }

    protected getDefaultMaterialId(): string
    {
        return this.type;
    }
}
