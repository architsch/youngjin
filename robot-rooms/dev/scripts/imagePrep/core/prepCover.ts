// A part of a re-mapped picture painted over with surface taken from elsewhere in it (see CoverUtil): whatever
// stood up from a squared face, covered with the face around it. The new surface fades in along the part's edge, so
// the part is set a little wider than the thing covered. Its shape is as PrepKeep's, though its rect may run past
// the picture's edge, where there is no edge to fade along.
export default interface PrepCover
{
    shape: "rect" | "ellipse";
    rect: [number, number, number, number];
    radius?: number;
    // Where the surface comes from.
    // "mirror": the same place across the picture's upright middle line, flipped (the other side of something
    // symmetric, which brings its edges and corners along), shaded to match where it lands.
    // [x, y]: the top-left corner of a region of the same size elsewhere, in fractions of the re-mapped picture,
    // shaded likewise.
    // "across", "down": the surface just outside the part's left and right edges (or its top and bottom ones), run
    // from the one to the other: for a plain surface, whose lines that way carry on and whose grain is lost.
    from: "mirror" | "across" | "down" | [number, number];
}
