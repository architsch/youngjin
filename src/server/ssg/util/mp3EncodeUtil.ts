import { spawn } from "child_process";

// LAME's variable-bitrate quality, from 0 (best) to 9 (smallest).
export const MP3_VBR_QUALITY = 5;

const Mp3EncodeUtil =
{
    // Interleaved 16-bit little-endian samples, encoded by LAME (https://lame.sourceforge.io), which must be on the PATH.
    // Written straight to a file: LAME writes the header that tells decoders how much delay to trim only where it can
    // go back to the start.
    encode: (pcm: Buffer, numChannels: number, sampleRate: number, filePath: string): Promise<void> =>
    {
        return new Promise((resolve, reject) =>
        {
            const kHz = String(sampleRate / 1000);
            const lame = spawn("lame", ["-r", "-s", kHz, "--bitwidth", "16", "--signed", "--little-endian",
                "-m", (numChannels == 1) ? "m" : "j", "-V", String(MP3_VBR_QUALITY), "--resample", kHz, "--silent",
                "-", filePath], {stdio: ["pipe", "ignore", "pipe"]});
            let errorOutput = "";
            lame.stderr.on("data", chunk => errorOutput += chunk);
            lame.on("error", (err: NodeJS.ErrnoException) => reject((err.code == "ENOENT")
                ? new Error("LAME is not installed (brew install lame)") : err));
            lame.on("close", code => (code == 0)
                ? resolve() : reject(new Error(`LAME exited with code ${code} (${errorOutput.trim()})`)));
            // Writing to a LAME that has already quit is reported on its close.
            lame.stdin.on("error", () => {});
            lame.stdin.end(pcm);
        });
    },
}

export default Mp3EncodeUtil;
