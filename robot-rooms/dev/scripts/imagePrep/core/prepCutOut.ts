// One thing an order's cut-out keeps (see MaskUtil): what the model that tells things apart is shown of it (see
// Segmenter). Positions are fractions of the picture's width and height, as a survey labels them.
export default interface PrepCutOut
{
    // A rectangle close around the thing: x, y, width and height. One of rect and on, or both.
    rect?: [number, number, number, number];
    // Points on the thing, one on each stretch of it that looks unlike the rest.
    on?: [number, number][];
    // Points on what the model took for the thing and isn't.
    off?: [number, number][];
    // Takes the thing out of what the parts before it kept (something standing in front of them).
    drop?: boolean;
}
