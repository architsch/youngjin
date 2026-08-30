export default interface ObjectLabelProps
{
    // What the object is called at the moment, and which position in the lettering palette that name
    // is written in (see ColorPaletteMap).
    initialText: string;
    initialColorIndex: number;
    // Both are handed over the moment they change. Seeing the name on the object is how it is judged,
    // exactly as the color is, so there is nothing for a confirming button to add — and a form narrow
    // enough to be read on a phone has no room to stand one beside the field anyway.
    onSetText: (text: string) => void;
    onSetColorIndex: (colorIndex: number) => void;
}
