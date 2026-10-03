import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";
import sharp from "sharp";
import RgbaImage from "../../imageMapEditor/core/rgbaImage";
import ImageProcessingUtil from "../../imageMapEditor/core/imageProcessingUtil";
import CutoutUtil from "../core/cutoutUtil";

// Real-ESRGAN's ncnn build for macOS with its models (BSD-3-Clause): fetched once into the work directory, which is
// gitignored, and refused unless it is the file this hash names.
const RELEASE_URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip";
const RELEASE_SHA256 = "e0ad05580abfeb25f8d8fb55aaf7bedf552c375b5b4d9bd3c8d59764d2cc333a";
const BINARY_NAME = "realesrgan-ncnn-vulkan";
// A general model for photos, which enlarges four times and nothing else.
const MODEL = "realesrgan-x4plus";
const FACTOR = 4;
// How far the object's colors are carried under a cut-out's transparency first, in pixels: past what the model takes
// in around a pixel, so it has no edge against the hidden color to sharpen.
const CARRY_REACH = 32;

// Enlarges pictures with Real-ESRGAN, which draws in detail a plain resize can't (and invents it: small lettering
// comes out as made-up glyphs).
export default class Upscaler
{
    private readonly toolDir: string;
    private readonly cacheDir: string;

    constructor(workDir: string)
    {
        this.toolDir = path.join(workDir, "tools/realesrgan");
        this.cacheDir = path.join(workDir, "upscaled");
    }

    // The picture four times as large. A cut-out's colors and its alpha go through as two pictures and are put back
    // together. Kept by the picture's content, so a plan run again reads it back.
    async upscale(image: RgbaImage): Promise<RgbaImage>
    {
        const key = crypto.createHash("sha1").update(`${image.width}x${image.height}`).update(image.data).digest("hex");
        const cachedPath = path.join(this.cacheDir, `${key}.png`);
        if (fs.existsSync(cachedPath))
            return decode(sharp(cachedPath));

        const binary = await this.install();
        fs.mkdirSync(this.cacheDir, {recursive: true});
        const cutOut = ImageProcessingUtil.hasTransparency(image);
        const colors = ImageProcessingUtil.copyImage(image);
        if (cutOut)
            CutoutUtil.carryColors(colors, CARRY_REACH);
        const result = await this.run(binary, `${key}.colors`, encode(colors).removeAlpha());
        if (cutOut)
        {
            const alpha = await this.run(binary, `${key}.alpha`, encode(image).extractChannel(3).toColourspace("b-w"));
            for (let p = 0; p < result.width * result.height; ++p)
                result.data[p * 4 + 3] = alpha.data[p * 4];
        }
        await encode(result).png().toFile(cachedPath);
        return result;
    }

    private async run(binary: string, name: string, picture: sharp.Sharp): Promise<RgbaImage>
    {
        const inPath = path.join(this.cacheDir, `${name}.in.png`);
        const outPath = path.join(this.cacheDir, `${name}.out.png`);
        await picture.png().toFile(inPath);
        try
        {
            // It reports its progress on stderr, and a failure there too.
            execFileSync(binary, ["-i", inPath, "-o", outPath, "-n", MODEL, "-s", String(FACTOR),
                "-m", path.join(this.toolDir, "models")], {stdio: ["ignore", "ignore", "pipe"]});
            if (!fs.existsSync(outPath))
                throw new Error("it wrote nothing");
            return await decode(sharp(outPath));
        }
        catch (err)
        {
            const stderr = (err as {stderr?: Buffer}).stderr?.toString().trim().split("\n").slice(-3).join("; ");
            throw new Error(`Real-ESRGAN failed: ${stderr || ((err instanceof Error) ? err.message : err)}`);
        }
        finally
        {
            fs.rmSync(inPath, {force: true});
            fs.rmSync(outPath, {force: true});
        }
    }

    // Returns where the program is, fetching it the first time.
    private async install(): Promise<string>
    {
        const binary = path.join(this.toolDir, BINARY_NAME);
        if (fs.existsSync(binary))
            return binary;
        if (process.platform != "darwin")
            throw new Error(`Upscaling runs Real-ESRGAN's macOS build, and this machine is ${process.platform}`);

        console.log(`Fetching Real-ESRGAN (BSD-3-Clause, about 50 MB) into ${this.toolDir}`);
        const response = await fetch(RELEASE_URL, {redirect: "follow"});
        if (!response.ok)
            throw new Error(`Downloading ${RELEASE_URL} failed (${response.status})`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
        if (sha256 != RELEASE_SHA256)
            throw new Error(`${RELEASE_URL} is no longer the file expected (its sha256 is ${sha256})`);

        fs.mkdirSync(this.toolDir, {recursive: true});
        const zipPath = path.join(this.toolDir, "release.zip");
        fs.writeFileSync(zipPath, bytes);
        execFileSync("unzip", ["-q", "-o", zipPath, "-d", this.toolDir]);
        fs.rmSync(zipPath);
        fs.chmodSync(binary, 0o755);
        return binary;
    }
}

function encode(image: RgbaImage): sharp.Sharp
{
    return sharp(Buffer.from(image.data.buffer, image.data.byteOffset, image.data.length),
        {raw: {width: image.width, height: image.height, channels: 4}});
}

async function decode(image: sharp.Sharp): Promise<RgbaImage>
{
    const {data, info} = await image.ensureAlpha().raw().toBuffer({resolveWithObject: true});
    return {width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)};
}
