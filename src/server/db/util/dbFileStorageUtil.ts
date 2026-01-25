import FirebaseUtil from "../../networking/util/firebaseUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import ServerLogUtil from "../../networking/util/serverLogUtil";

const DBFileStorageUtil =
{
    saveBinaryFile: async (filePath: string, buffer: Buffer): Promise<boolean> =>
    {
        try {
            const bucket = FirebaseUtil.getStorage().bucket();
            const file = bucket.file(filePath);
            await file.save(buffer, {
                metadata: {
                    contentType: "application/octet-stream",
                },
                resumable: false,
            });
            return true;
        } catch (err) {
            ServerLogUtil.log("saveBinaryFile failed", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "pink");
            return false;
        }
    },
    loadBinaryFile: async (filePath: string): Promise<Buffer | null> =>
    {
        try {
            const bucket = FirebaseUtil.getStorage().bucket();
            const file = bucket.file(filePath);
            const contents = await file.download();
            const buffer = Buffer.concat(contents);
            if (buffer.length > 0)
                return buffer;
            else
                return null;
        } catch (err) {
            ServerLogUtil.log("loadBinaryFile failed", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "pink");
            return null;
        }
    },
    deleteFile: async (filePath: string): Promise<boolean> =>
    {
        try {
            const bucket = FirebaseUtil.getStorage().bucket();
            const file = bucket.file(filePath);
            const responses = await file.delete();
            for (const response of responses)
            {
                const statusCode = response.statusCode;
                if (statusCode < 200 || statusCode >= 300)
                {
                    ServerLogUtil.log("deleteFile failure found in response", {response: JSON.stringify(response)}, "high", "pink");
                    return false;
                }
            }
            return true;
        } catch (err) {
            ServerLogUtil.log("deleteFile failed", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "pink");
            return false;
        }
    },
}

export default DBFileStorageUtil;