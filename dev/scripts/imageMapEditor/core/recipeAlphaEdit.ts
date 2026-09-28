// A hand edit to what of a sample is kept (see AlphaMaskUtil.getKeepMask). Positions are fractions of the sample's
// width and height, and a radius a fraction of its shorter side, so an edit holds at any resolution; it stays put
// in the sample's frame when the quad is moved.
type RecipeAlphaEdit =
    // A brush stroke through the points: takes out, or brings back, what it covers.
    | {kind: "erase" | "restore", radius: number, points: [number, number][]}
    // Takes out every pixel close (CIELAB distance) to the color at the point, anywhere in the sample.
    | {kind: "eraseColor", point: [number, number], tolerance: number};

export default RecipeAlphaEdit;
