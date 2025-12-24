export default class BufferState
{
    view: Uint8Array;
    byteIndex: number;

    constructor(view: Uint8Array)
    {
        this.view = view;
        this.byteIndex = 0;
    }
}