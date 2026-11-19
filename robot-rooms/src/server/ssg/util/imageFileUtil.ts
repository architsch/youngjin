import sharp from "sharp";
import FileUtil from "./fileUtil";
import LogUtil from "../../../shared/system/util/logUtil";

const ImageFileUtil =
{
    readImage: (relativeFilePath: string, rootDir?: string): sharp.Sharp | undefined =>
    {
        try {
            const absoluteFilePath = FileUtil.getAbsoluteFilePath(relativeFilePath, rootDir);
            return sharp(absoluteFilePath);
        }
        catch (err) {
            LogUtil.log("Failed to read file", {relativeFilePath, err}, "high", "error");
            return undefined;
        }
    },
    writeImage: async (relativeFilePath: string, image: sharp.Sharp, rootDir?: string): Promise<sharp.OutputInfo | undefined> =>
    {
        try {
            const absoluteFilePath = FileUtil.getAbsoluteFilePath(relativeFilePath, rootDir);
            await image.toFile(absoluteFilePath);
        }
        catch (err) {
            LogUtil.log("Failed to write file", {relativeFilePath, err} as any, "high", "error");
            return undefined;
        }
    },
}

export default ImageFileUtil;
