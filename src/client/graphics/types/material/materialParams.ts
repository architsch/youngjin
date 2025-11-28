export default abstract class MaterialParams
{
    type: string;

    constructor(type: string)
    {
        this.type = type;
    }

    getMaterialId(): string
    {
        return this.type;
    }
}