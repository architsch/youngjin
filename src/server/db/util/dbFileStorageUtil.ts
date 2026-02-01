import FirebaseUtil from "../../networking/util/firebaseUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import LogUtil from "../../../shared/system/util/logUtil";

const DBFileStorageUtil =
{
    saveBinaryFile: async (filePath: string, buffer: Buffer): Promise<boolean> =>
    {
        LogUtil.log("DBFileStorageUtil.saveBinaryFile", {filePath, bufferLength: buffer.length}, "low", "info");
        try {
            const bucket = (await FirebaseUtil.getStorage()).bucket();
            const file = bucket.file(filePath);
            await file.save(buffer, {
                metadata: {
                    contentType: "application/octet-stream",
                },
                resumable: false,
            });
            return true;
        } catch (err) {
            LogUtil.log("DBFileStorageUtil.saveBinaryFile failed", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "error");
            return false;
        }
    },
    loadBinaryFile: async (filePath: string): Promise<Buffer | null> =>
    {
        LogUtil.log("DBFileStorageUtil.loadBinaryFile", {filePath}, "low", "info");
        try {
            const bucket = (await FirebaseUtil.getStorage()).bucket();
            const file = bucket.file(filePath);
            const contents = await file.download();
            const buffer = Buffer.concat(contents);
            if (buffer.length > 0)
                return buffer;
            else
                return null;
        } catch (err) {
            LogUtil.log("DBFileStorageUtil.loadBinaryFile failed", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "error");
            return null;
        }
    },
    deleteFile: async (filePath: string): Promise<boolean> =>
    {
        LogUtil.log("DBFileStorageUtil.deleteFile", {filePath}, "low", "info");
        try {
            const bucket = (await FirebaseUtil.getStorage()).bucket();
            const file = bucket.file(filePath);
            const responses = await file.delete();
            for (const response of responses)
            {
                const statusCode = response.statusCode;
                if (statusCode < 200 || statusCode >= 300)
                {
                    LogUtil.log("DBFileStorageUtil.deleteFile :: failure found in response", {response: JSON.stringify(response)}, "high", "error");
                    return false;
                }
            }
            return true;
        } catch (err) {
            LogUtil.log("DBFileStorageUtil.deleteFile :: failed", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "error");
            return false;
        }
    },
}

export default DBFileStorageUtil;