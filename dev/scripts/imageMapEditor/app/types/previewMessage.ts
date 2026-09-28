import RgbaImage from "../../core/rgbaImage";
import ImageRecipe from "../../core/imageRecipe";

// What the page tells the previews' worker (see previewWorker.ts): the source to render from (its pixels, or where
// to fetch it at full size), or a render of it (with or without the game image).
type PreviewMessage =
    | {kind: "source", sha1: string, source: RgbaImage}
    | {kind: "sourceUrl", sha1: string, url: string}
    | {kind: "render", id: number, sha1: string, recipe: ImageRecipe, maxSide: number, cellSize: number,
        showRemoved: boolean, withGameImage: boolean};

export default PreviewMessage;
