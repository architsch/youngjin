import RgbaImage from "../../core/rgbaImage";

// A finished render of a draft's previews (see previewWorker.ts).
export default interface PreviewResult
{
    id: number;
    sha1: string;
    // The sample as shown: what was taken out tinted instead of see-through, when asked for.
    shown: RgbaImage;
    // Undefined when not asked for (the magnified view's renders).
    gameImage: RgbaImage | undefined;
}
