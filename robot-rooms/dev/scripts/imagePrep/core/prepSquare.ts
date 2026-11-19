// A flat face seen at an angle, squared up (see PrepRenderUtil): its four corners go to a rectangle's. Positions are
// fractions of the picture's width and height, as a survey labels them.
export default interface PrepSquare
{
    // The face's corners: top-left, top-right, bottom-right, bottom-left. They may fall outside the picture (a
    // rounded corner's, or one the picture cuts off). One of corners and sides.
    corners?: [number, number][];
    // For a cut-out whose outline is the face's own edge: the stretches of each side, from and to along it, where
    // the outline runs straight (clear of rounded corners and of whatever stands in front). A line is fitted to each
    // side, and the corners are where the lines meet.
    sides?: {left: [number, number][], right: [number, number][], top: [number, number][], bottom: [number, number][]};
    // The face's real width over its height. One of aspect and circle; with neither, the shape is taken from the
    // quad's own sides, which holds only for a face seen nearly head-on.
    aspect?: number;
    // Five or more points on the outline of something round lying in the face's plane, or parallel to it (a drain,
    // a burner, a plate): the face gets the shape that makes it round again.
    circle?: [number, number][];
    // Room kept past the face's left, top, right and bottom edges, each a share of the face's width or height, for
    // what lies beyond it.
    extend?: [number, number, number, number];
}
