export default interface ObjectLabelProps
{
    // Current label text and its lettering palette index (see ColorPaletteMap).
    initialText: string;
    initialColorIndex: number;
    // Called on every change; no confirm step.
    onSetText: (text: string) => void;
    onSetColorIndex: (colorIndex: number) => void;
}
