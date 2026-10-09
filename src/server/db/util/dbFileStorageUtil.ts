import zlib from "zlib";
import { promisify } from "util";
import FirebaseUtil from "../../networking/util/firebaseUtil";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import LogUtil from "../../../shared/system/util/logUtil";
import LatencySimUtil from "../../system/util/latencySimUtil";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Files are stored gzipped. One saved before they were is told apart by how it starts: a gzip stream with
// these two bytes, a room's contents with their format version (a small number).
const GZIP_MAGIC_BYTES = [0x1f, 0x8b];

const DBFileStorageUtil =
{
    saveBinaryFile: async (filePath: string, buffer: Buffer): Promise<boolean> =>
    {
        LogUtil.log("DBFileStorageUtil.saveBinaryFile", {filePath, bufferLength: buffer.length}, "low", "info");
        await LatencySimUtil.simulateDBLatency();
        try {
            const bucket = (await FirebaseUtil.getStorage()).bucket();
            const file = bucket.file(filePath);
            await file.save(await gzip(buffer), {
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
        await LatencySimUtil.simulateDBLatency();
        try {
            const bucket = (await FirebaseUtil.getStorage()).bucket();
            const file = bucket.file(filePath);
            const contents = await file.download();
            const buffer = Buffer.concat(contents);
            if (buffer.length == 0)
                return null;
            const gzipped = GZIP_MAGIC_BYTES.every((byte, i) => buffer[i] == byte);
            return gzipped ? await gunzip(buffer) : buffer;
        } catch (err) {
            LogUtil.log("DBFileStorageUtil.loadBinaryFile failed", {errorMessage: ErrorUtil.getErrorMessage(err)}, "high", "error");
            return null;
        }
    },
    deleteFile: async (filePath: string): Promise<boolean> =>
    {
        LogUtil.log("DBFileStorageUtil.deleteFile", {filePath}, "low", "info");
        await LatencySimUtil.simulateDBLatency();
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