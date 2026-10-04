import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { execFileSync } from "child_process";
import sharp from "sharp";
import RgbaImage from "../../imageMapEditor/core/rgbaImage";
import MaskFinder from "../core/maskFinder";

// What is used here of ONNX Runtime, which is fetched and so brings no types of its own.
type Session = {
    run(feeds: {[name: string]: unknown}): Promise<{[name: string]: {data: Float32Array}}>,
    release(): Promise<void>,
};
type Runtime = {
    Tensor: new (type: "float32", data: Float32Array, dims: number[]) => unknown,
    InferenceSession: {create(file: string, options: {logSeverityLevel: number}): Promise<Session>},
};

// ONNX Runtime's Node binding (MIT), as its npm packages: fetched once into the work directory, which is gitignored,
// and refused unless they are the files these hashes name.
const RUNTIME_VERSION = "1.30.0";
const RUNTIME_PACKAGES = [
    {name: "onnxruntime-node", sha256: "6e3390d6b783e7be946fad629292799da28d0b42f84856e50d2c1b0383291e75"},
    {name: "onnxruntime-common", sha256: "7906c439e0d3e0f4048caa23b64cdfadc0f455c377f579ce1ab2a4b778f07d5f"},
];
// Segment Anything 2 (Meta, Apache-2.0), its large model as exported to ONNX by Viet-Anh Nguyen (Apache-2.0):
// fetched and checked likewise. The smaller models leave things half kept.
const MODEL_URL = "https://huggingface.co/vietanhdev/segment-anything-2-onnx-models/resolve/071f58077599431edd0e5d2ac52ecca4c78f1cab";
const MODEL_FILES = [
    {name: "sam2_hiera_large.encoder.onnx", sha256: "cb252d7b59fdeb2567f7134ed9f23d712e4f24584628913bbcb0ea72ba72b617"},
    {name: "sam2_hiera_large.decoder.onnx", sha256: "2b5a3d40a017e61d2cb4fac7147ebf899d24b082753fb5049be3810d2318ca07"},
];
// The model takes a frame in as a square of this side, whatever the frame's shape, and gives masks on a grid of
// that one.
const INPUT_SIDE = 1024;
const GRID_SIDE = 256;
const MEAN = [0.485, 0.456, 0.406];
const DEVIATION = [0.229, 0.224, 0.225];
// Shown to the model behind whatever of the picture is see-through already.
const BACKDROP = "#808080";
// What the model takes each point of its prompt for.
const OFF = 0, ON = 1, RECT_START = 2, RECT_END = 3;
// An embedding is 16 MB, and the whole picture's is asked for again with every part.
const EMBEDDINGS_HELD = 2;

// Tells a thing in a picture from what isn't it with Segment Anything 2: a model that is shown a rect around the
// thing and points on and off it, and answers with the thing's mask.
export default class Segmenter
{
    private readonly toolDir: string;
    private readonly cacheDir: string;
    private sessions?: Promise<{runtime: Runtime, encoder: Session, decoder: Session}>;
    private readonly embeddings = new Map<string, Promise<{[name: string]: unknown}>>();
    private readonly pictureKeys = new WeakMap<RgbaImage, string>();

    constructor(workDir: string)
    {
        this.toolDir = path.join(workDir, "tools");
        this.cacheDir = path.join(workDir, "masks");
    }

    // The best of the masks the model offers (see MaskFinder). Kept by what was asked, so a plan run again asks the
    // model only for what changed.
    readonly findMask: MaskFinder = async (picture, frame, part, guess) =>
    {
        const key = crypto.createHash("sha1")
            .update(JSON.stringify([MODEL_FILES[0].sha256, this.getPictureKey(picture), frame, part.rect ?? null,
                part.on ?? [], part.off ?? []]))
            .update((guess != undefined) ? new Uint8Array(guess.buffer, guess.byteOffset, guess.byteLength) : "")
            .digest("hex");
        const cachedPath = path.join(this.cacheDir, `${key}.f32`);
        if (fs.existsSync(cachedPath))
        {
            const bytes = fs.readFileSync(cachedPath);
            const values = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
            return {logits: values.slice(0, -1), score: values[values.length - 1]};
        }

        const [left, top, width, height] = frame;
        // Onto the model's input, whose pixels have their middles at whole numbers.
        const place = ([x, y]: [number, number]) => [
            Math.min(INPUT_SIDE, Math.max(0, (x * picture.width - left) / width * INPUT_SIDE)) - 0.5,
            Math.min(INPUT_SIDE, Math.max(0, (y * picture.height - top) / height * INPUT_SIDE)) - 0.5];
        const inFrame = ([x, y]: [number, number]) => x * picture.width >= left && x * picture.width <= left + width
            && y * picture.height >= top && y * picture.height <= top + height;
        const coords: number[] = [], labels: number[] = [];
        for (const point of (part.on ?? []).filter(inFrame))
        {
            coords.push(...place(point));
            labels.push(ON);
        }
        for (const point of (part.off ?? []).filter(inFrame))
        {
            coords.push(...place(point));
            labels.push(OFF);
        }
        if (part.rect != undefined)
        {
            const [x, y, w, h] = part.rect;
            coords.push(...place([x, y]), ...place([x + w, y + h]));
            labels.push(RECT_START, RECT_END);
        }

        const {runtime, decoder} = await this.getSessions();
        const cells = GRID_SIDE * GRID_SIDE;
        const found = await decoder.run({
            ...await this.embed(picture, frame),
            point_coords: new runtime.Tensor("float32", Float32Array.from(coords), [1, labels.length, 2]),
            point_labels: new runtime.Tensor("float32", Float32Array.from(labels), [1, labels.length]),
            mask_input: new runtime.Tensor("float32", guess ?? new Float32Array(cells), [1, 1, GRID_SIDE, GRID_SIDE]),
            has_mask_input: new runtime.Tensor("float32", Float32Array.from([(guess != undefined) ? 1 : 0]), [1]),
        });
        // It offers a few masks, each with how well it reckons the mask to match the thing.
        const scores = Array.from(found.iou_predictions.data);
        const best = scores.indexOf(Math.max(...scores));
        const kept = new Float32Array(cells + 1);
        kept.set(found.masks.data.subarray(best * cells, (best + 1) * cells));
        kept[cells] = scores[best];

        fs.mkdirSync(this.cacheDir, {recursive: true});
        fs.writeFileSync(cachedPath, new Uint8Array(kept.buffer));
        return {logits: kept.slice(0, cells), score: scores[best]};
    };

    // Whether the model, and what runs it, are on this machine already: if not, the first mask asked for fetches them.
    isInstalled(): boolean
    {
        return fs.existsSync(this.getRuntimeMarker()) && this.getModelPaths().every(file => fs.existsSync(file));
    }

    // Lets the model go, if it was ever loaded. Its threads outlive the last mask otherwise, and now and then
    // bring the process down as it exits.
    async release(): Promise<void>
    {
        const sessions = await this.sessions?.catch(() => undefined);
        this.sessions = undefined;
        this.embeddings.clear();
        await sessions?.encoder.release();
        await sessions?.decoder.release();
    }

    // What the model makes of the frame, which every mask found within it is read from.
    private embed(picture: RgbaImage, frame: number[]): Promise<{[name: string]: unknown}>
    {
        const key = `${this.getPictureKey(picture)}:${frame.join(",")}`;
        const embedding = this.embeddings.get(key) ?? this.encode(picture, frame);
        // Asked for last, let go of last.
        this.embeddings.delete(key);
        this.embeddings.set(key, embedding);
        while (this.embeddings.size > EMBEDDINGS_HELD)
            this.embeddings.delete(this.embeddings.keys().next().value!);
        return embedding;
    }

    private async encode(picture: RgbaImage, [left, top, width, height]: number[]): Promise<{[name: string]: unknown}>
    {
        const {data, info} = await sharp(Buffer.from(picture.data.buffer, picture.data.byteOffset, picture.data.length),
            {raw: {width: picture.width, height: picture.height, channels: 4}})
            .extract({left, top, width, height}).flatten({background: BACKDROP})
            .resize(INPUT_SIDE, INPUT_SIDE, {fit: "fill"}).raw().toBuffer({resolveWithObject: true});
        // Each color as its own plane, about the mean the model was trained to.
        const plane = INPUT_SIDE * INPUT_SIDE;
        const input = new Float32Array(3 * plane);
        for (let p = 0; p < plane; ++p)
        {
            for (let channel = 0; channel < 3; ++channel)
                input[channel * plane + p] = (data[p * info.channels + channel] / 255 - MEAN[channel]) / DEVIATION[channel];
        }
        const {runtime, encoder} = await this.getSessions();
        return encoder.run({image: new runtime.Tensor("float32", input, [1, 3, INPUT_SIDE, INPUT_SIDE])});
    }

    private getPictureKey(picture: RgbaImage): string
    {
        let key = this.pictureKeys.get(picture);
        if (key == undefined)
        {
            key = crypto.createHash("sha1").update(`${picture.width}x${picture.height}`).update(picture.data).digest("hex");
            this.pictureKeys.set(picture, key);
        }
        return key;
    }

    private getSessions(): Promise<{runtime: Runtime, encoder: Session, decoder: Session}>
    {
        this.sessions ??= (async () => {
            const runtime = await this.installRuntime();
            const [encoderPath, decoderPath] = await this.installModel();
            // Told only of errors: it warns of every unused node in the model's graph otherwise.
            const options = {logSeverityLevel: 3};
            return {runtime, encoder: await runtime.InferenceSession.create(encoderPath, options),
                decoder: await runtime.InferenceSession.create(decoderPath, options)};
        })();
        return this.sessions;
    }

    // Returns ONNX Runtime, fetching it the first time: of the builds its package holds, this machine's alone.
    private async installRuntime(): Promise<Runtime>
    {
        const installed = this.getRuntimeMarker();
        const dir = path.dirname(installed);
        if (!fs.existsSync(installed))
        {
            console.log(`Fetching ONNX Runtime (MIT, about 115 MB) into ${dir}`);
            for (const {name, sha256} of RUNTIME_PACKAGES)
            {
                const packageDir = path.join(dir, "node_modules", name);
                fs.rmSync(packageDir, {recursive: true, force: true});
                fs.mkdirSync(packageDir, {recursive: true});
                const archive = path.join(dir, `${name}.tgz`);
                await fetchFile(`https://registry.npmjs.org/${name}/-/${name}-${RUNTIME_VERSION}.tgz`, sha256, archive);
                const members = (name != "onnxruntime-node") ? []
                    : ["package/package.json", "package/dist", `package/bin/napi-v6/${process.platform}/${process.arch}`];
                try
                {
                    execFileSync("tar", ["-xzf", archive, "-C", packageDir, "--strip-components=1", ...members],
                        {stdio: ["ignore", "ignore", "pipe"]});
                }
                catch (err)
                {
                    const stderr = (err as {stderr?: Buffer}).stderr?.toString().trim().split("\n").slice(-2).join("; ");
                    throw new Error(`ONNX Runtime ${RUNTIME_VERSION} could not be unpacked for ${process.platform} on `
                        + `${process.arch}: ${stderr || ((err instanceof Error) ? err.message : err)}`);
                }
                fs.rmSync(archive);
            }
            fs.writeFileSync(installed, "");
        }
        return createRequire(path.join(dir, "package.json"))("onnxruntime-node") as Runtime;
    }

    // Returns where the model's two halves are, fetching them the first time.
    private async installModel(): Promise<string[]>
    {
        const files = this.getModelPaths();
        const dir = path.dirname(files[0]);
        if (files.every(file => fs.existsSync(file)))
            return files;
        console.log(`Fetching Segment Anything 2 (Apache-2.0, about 910 MB) into ${dir}`);
        fs.mkdirSync(dir, {recursive: true});
        for (let i = 0; i < files.length; ++i)
        {
            if (!fs.existsSync(files[i]))
                await fetchFile(`${MODEL_URL}/${MODEL_FILES[i].name}`, MODEL_FILES[i].sha256, files[i]);
        }
        return files;
    }

    // Written once ONNX Runtime is unpacked whole.
    private getRuntimeMarker(): string
    {
        return path.join(this.toolDir, "onnxruntime", `${RUNTIME_VERSION}.installed`);
    }

    private getModelPaths(): string[]
    {
        return MODEL_FILES.map(file => path.join(this.toolDir, "sam2", file.name));
    }
}

// Downloads the file, which is there afterwards only if it is the one the hash names.
async function fetchFile(url: string, sha256: string, filePath: string): Promise<void>
{
    const response = await fetch(url, {redirect: "follow"});
    if (!response.ok || response.body == null)
        throw new Error(`Downloading ${url} failed (${response.status})`);
    const partPath = `${filePath}.part`;
    const hash = crypto.createHash("sha256");
    const file = fs.openSync(partPath, "w");
    try
    {
        for await (const chunk of response.body)
        {
            hash.update(chunk);
            fs.writeSync(file, chunk);
        }
    }
    finally
    {
        fs.closeSync(file);
    }
    const found = hash.digest("hex");
    if (found != sha256)
    {
        fs.rmSync(partPath);
        throw new Error(`${url} is no longer the file expected (its sha256 is ${found})`);
    }
    fs.renameSync(partPath, filePath);
}
