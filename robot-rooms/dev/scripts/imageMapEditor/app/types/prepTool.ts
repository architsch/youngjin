// What pointing at the source does while it is preprocessed (see PrepCanvas): nothing, draw the box around the part
// of a cut-out picked, click points on that part or off it, or click points around the outline of something round (in
// a squared face's plane, or the thing made round).
type PrepTool = "none" | "box" | "on" | "off" | "circle" | "outline";

export default PrepTool;
