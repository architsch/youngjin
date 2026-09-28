// What pointing at the sample does (see SampleCanvas): nothing, mark background for the fill, brush pixels out or
// back in, take out a color everywhere, or draw, pick, move, resize and turn the selections the sample is cut to.
type SampleTool = "none" | "mark" | "erase" | "restore" | "eraseColor" | "select";

export default SampleTool;
