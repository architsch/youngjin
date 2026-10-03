import RgbaImage from "../../imageMapEditor/core/rgbaImage";
import PrepCutOut from "./prepCutOut";

// Finds the thing a part names within one frame of a picture (left, top, width and height, in pixels), which is all
// the model looks at (see Segmenter.findMask). The mask is a square grid over the frame, row by row: a logit per
// cell, above zero where the thing is; score is the model's own, from 0 to 1. guess is an earlier mask of the thing
// on the same grid, for the model to start from.
type MaskFinder = (picture: RgbaImage, frame: [number, number, number, number], part: PrepCutOut,
    guess?: Float32Array) => Promise<{logits: Float32Array, score: number}>;

export default MaskFinder;
