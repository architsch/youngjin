import RgbaImage from "../../core/rgbaImage";

// The source photo a draft is sampled from, decoded small for the previews (a save renders on the server, from
// the file itself).
export default interface LoadedSource
{
    sha1: string;
    fileName: string;
    // The photo's own size, upright.
    width: number;
    height: number;
    preview: RgbaImage;
    // The preview, drawn once for showing.
    previewCanvas: HTMLCanvasElement;
}
