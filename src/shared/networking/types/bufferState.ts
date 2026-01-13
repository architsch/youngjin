export default class BufferState
{
    view: Uint8Array;
    byteIndex: number;

    constructor(view: Uint8Array, byteIndex: number = 0)
    {
        this.view = view;
        this.byteIndex = byteIndex;
    }
}