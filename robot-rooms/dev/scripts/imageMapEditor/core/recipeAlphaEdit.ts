// A hand edit to what of a sample is kept (see AlphaMaskUtil.getKeepMask). Positions are fractions of the sample's
// width and height, and a radius a fraction of its shorter side, so an edit holds at any resolution; it stays put
// in the sample's frame when the quad is moved.
type RecipeAlphaEdit =
    // A brush stroke through the points: takes out, or brings back, what it covers.
    | {kind: "erase" | "restore", radius: number, points: [number, number][]}
    // Takes out the patch of color at the point: what a fill reaches from it through pixels that are still kept and
    // close (CIELAB distance) to the color there.
    | {kind: "eraseColor", point: [number, number], tolerance: number};

export default RecipeAlphaEdit;
