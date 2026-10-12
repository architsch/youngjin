import * as THREE from "three";
import App from "../../../app";
import ImageMetadata from "../../../../shared/graphics/image/types/imageMetadata";
import ImageMapUtil from "../../../../shared/graphics/image/util/imageMapUtil";
import Vec2 from "../../../../shared/math/types/vec2";
import RoomFile from "../../../../shared/room/types/roomFile";
import { COLLISION_LAYER_HEIGHT, COLLISION_LAYER_MAX, COLLISION_LAYER_MIN, MAX_ROOM_X, MAX_ROOM_Y,
    MAX_ROOM_Z } from "../../../../shared/system/sharedConstants";
import { ROOM_PREVIEW_VIEW_DIR } from "../../../system/clientConstants";
import MeshFactory from "../../factories/meshFactory";
import TextureFactory from "../../factories/textureFactory";
import GraphicsManager from "../../graphicsManager";
import LightBlockMapMaterialUtil from "../../light/util/lightBlockMapMaterialUtil";
import RoomPreviewLevel from "../types/roomPreviewLevel";
import RoomPreviewObjectUtil from "./roomPreviewObjectUtil";
import RoomPreviewVoxelUtil from "./roomPreviewVoxelUtil";

// How the picture is lit: evenly, and by a light from over the camera's shoulder (how far to its right and above
// it, per unit of distance), so the three ways a face can be turned toward the camera are told apart. Not as the
// room is lit, which is how it looks from inside. The light is a point too far off for its rays to spread, and
// one that doesn't fade: the kinds of light the game itself draws with (see GraphicsManager).
const AMBIENT_LIGHT_INTENSITY = 1.2;
const KEY_LIGHT_INTENSITY = 1.8;
const KEY_LIGHT_SIDEWAYS = 0.2;
const KEY_LIGHT_RISE = 0.38;
const KEY_LIGHT_DISTANCE = 100000;

// What the room is shown against, and what its caps are drawn in (see RoomPreviewVoxelUtil.getCaps): darker still.
const BACKGROUND_COLOR = "#1e2939";
const CAP_COLOR = "#0c1018";

// The gap between two levels, in world units.
const LEVEL_GAP = 2;

// How much wider and higher than what it shows the picture is.
const FRAMING_MARGIN = 1.04;

// The shapes the picture may take (width over height), whatever the shape of what it shows.
const MIN_ASPECT_RATIO = 0.75;
const MAX_ASPECT_RATIO = 2;

// What the storeys of a room shown as two are called, the lower first.
const LEVEL_NAMES = ["1st Floor", "2nd Floor"];

// How a storey's name is written: its size and the room kept round it, in CSS pixels, and its color.
const LEVEL_NAME_FONT_SIZE = 14;
const LEVEL_NAME_MARGIN = 6;
const LEVEL_NAME_COLOR = "#d1d5dc";

// How far along the top of its storey's far wall a name ends: from the wall's near end (0) to the storey's far
// corner (1).
const LEVEL_NAME_PLACE = 0.7;

// How long an image is waited for. The picture is drawn without one that takes longer.
const IMAGE_LOAD_TIMEOUT_MS = 8000;

// How long the picture's shaders are waited for before it is drawn anyway, which then waits for them itself.
const SHADER_COMPILE_TIMEOUT_MS = 5000;

// The camera's turn and the axes of its picture: it looks along -ROOM_PREVIEW_VIEW_DIR, with no perspective.
const viewDir = new THREE.Vector3(ROOM_PREVIEW_VIEW_DIR.x, ROOM_PREVIEW_VIEW_DIR.y, ROOM_PREVIEW_VIEW_DIR.z).normalize();
const viewQuaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(viewDir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)));
const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(viewQuaternion);
const screenUp = new THREE.Vector3(0, 1, 0).applyQuaternion(viewQuaternion);

const vec3Temp = new THREE.Vector3();

// The picture of a room file's room that is shown before the file is loaded over a room (see LocalRoomFileUtil): the
// room as seen from outside and above, with no perspective, drawn off screen by the game's own renderer. A room
// with an upper floor is shown as two storeys apart, since the upper would hide the lower, each with its name.
// It is looked at for a moment, so it is drawn cheaply rather than finely: its edges are left unsmoothed.
const RoomPreviewUtil =
{
    // Draws the picture: as large as fits in maxWidth x maxHeight (in CSS pixels), with pixelRatio of its own
    // pixels to each, and shaped to what it shows. Throws if it can't be drawn.
    render: async (roomFile: RoomFile, maxWidth: number, maxHeight: number, pixelRatio: number): Promise<ImageData> =>
    {
        const renderer = GraphicsManager.getGameRenderer();
        if (renderer.getContext().isContextLost())
            throw new Error("RoomPreviewUtil :: The graphics context is lost.");
        const texturePackMap = ImageMapUtil.getImageMap("VoxelTexturePackImageMap");
        if (!texturePackMap.hasImagePath(roomFile.texturePackPath))
            throw new Error(`RoomPreviewUtil :: Unknown texture pack (texturePackPath = ${roomFile.texturePackPath})`);

        // The game's own copy of the pack is drawn with, where the game has that pack loaded (see VoxelGameObject).
        // Everything else below is made for this picture alone, and let go once it is drawn.
        const assetsURL = App.getEnv().assets_url;
        const texturePackURL = texturePackMap.getImageURLByPath(assetsURL, roomFile.texturePackPath);
        const gameTexturePack = TextureFactory.getLoadedTexture(texturePackURL);
        const scene = new THREE.Scene();
        const textures: THREE.Texture[] = [];
        const materials: THREE.Material[] = [];
        let target: THREE.WebGLRenderTarget | undefined;
        try
        {
            const texturePack = gameTexturePack ?? await loadTexture(texturePackURL, textures);
            if (!texturePack)
                throw new Error(`RoomPreviewUtil :: Failed to load the texture pack (texturePackPath = ${roomFile.texturePackPath})`);

            const levels = createLevels(roomFile);
            for (const level of levels)
                scene.add(level.group);
            const faceMaterial = new THREE.MeshPhongMaterial({map: texturePack});
            const capMaterial = new THREE.MeshPhongMaterial({color: CAP_COLOR});
            materials.push(faceMaterial, capMaterial);
            const faces = RoomPreviewVoxelUtil.getFaces(roomFile.voxelGrid, levels);
            const caps = RoomPreviewVoxelUtil.getCaps(roomFile.voxelGrid.voxels, levels);
            levels.forEach((level, i) => {
                addQuadMesh(level, faces[i].positions, faces[i].normals, faces[i].uvs, faceMaterial);
                addQuadMesh(level, caps[i].positions, caps[i].normals, undefined, capMaterial);
            });

            // One texture per image, however many objects show it. Thumbnails, which are larger than the picture
            // shows anything.
            const pictureMap = ImageMapUtil.getImageMap("PictureImageMap");
            const imageTextures: {[path: string]: Promise<THREE.Texture | undefined>} = {};
            const loadImage = (image: ImageMetadata) => imageTextures[image.path]
                ??= loadTexture(pictureMap.getThumbnailURLByPath(assetsURL, image.path), textures);
            materials.push(...await RoomPreviewObjectUtil.addObjects(roomFile.objectGroup, levels, loadImage));

            const contentRect = placeLevels(levels, maxWidth / maxHeight);
            scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY));
            const keyLight = new THREE.PointLight(0xffffff, KEY_LIGHT_INTENSITY, 0, 0);
            keyLight.position.copy(viewDir).addScaledVector(screenRight, KEY_LIGHT_SIDEWAYS)
                .addScaledVector(screenUp, KEY_LIGHT_RISE).multiplyScalar(KEY_LIGHT_DISTANCE);
            scene.add(keyLight);
            scene.background = new THREE.Color(BACKGROUND_COLOR);

            // The picture takes the shape of what it shows, within limits, and what it shows fills it.
            const contentWidth = FRAMING_MARGIN * (contentRect.max.x - contentRect.min.x);
            const contentHeight = FRAMING_MARGIN * (contentRect.max.y - contentRect.min.y);
            const aspectRatio = THREE.MathUtils.clamp(contentWidth / contentHeight, MIN_ASPECT_RATIO, MAX_ASPECT_RATIO);
            const width = Math.max(1, Math.round(pixelRatio * Math.min(maxWidth, maxHeight * aspectRatio)));
            const height = Math.max(1, Math.round(width / aspectRatio));
            const camera = createCamera(contentRect, Math.max(contentWidth, contentHeight * aspectRatio),
                Math.max(contentHeight, contentWidth / aspectRatio));

            // In sRGB, as a canvas is, so that what is read back from it is what gets shown.
            target = new THREE.WebGLRenderTarget(width, height);
            target.texture.colorSpace = THREE.SRGBColorSpace;
            const image = await draw(renderer, scene, camera, target);
            writeLevelNames(image, levels, camera, pixelRatio);
            return image;
        }
        finally
        {
            target?.dispose();
            scene.traverse(node => {
                if (node instanceof THREE.InstancedMesh)
                    node.dispose();
                if (node instanceof THREE.Mesh)
                    node.geometry.dispose();
            });
            for (const material of materials)
                material.dispose();
            for (const texture of textures)
                texture.dispose();
            // (The game's copy of the pack too, had the game let go of it meanwhile: the draw put it back on the GPU.)
            if (gameTexturePack && TextureFactory.getLoadedTexture(texturePackURL) != gameTexturePack)
                gameTexturePack.dispose();
        }
    },
}

// The room's levels, empty: its two storeys where it has an upper floor, which goes with the upper one.
function createLevels(roomFile: RoomFile): RoomPreviewLevel[]
{
    const upperFloorLayer = RoomPreviewVoxelUtil.getUpperFloorLayer(roomFile.voxelGrid.voxels);
    const layerRanges = (upperFloorLayer < 0)
        ? [[COLLISION_LAYER_MIN - 1, COLLISION_LAYER_MAX + 1]]
        : [[COLLISION_LAYER_MIN - 1, upperFloorLayer - 1], [upperFloorLayer, COLLISION_LAYER_MAX + 1]];
    return layerRanges.map(([layerMin, layerMax]) =>
        ({layerMin, layerMax, group: new THREE.Object3D(), bounds: new THREE.Box3()}));
}

function addQuadMesh(level: RoomPreviewLevel, positions: Float32Array, normals: Float32Array,
    uvs: Float32Array | undefined, material: THREE.Material): void
{
    if (positions.length == 0)
        return;
    const mesh = MeshFactory.createDetachedQuadMesh(positions, normals, uvs, material);
    mesh.geometry.computeBoundingBox();
    level.bounds.union(mesh.geometry.boundingBox!);
    level.group.add(mesh);
}

// A texture of its own for an image, or nothing for one that doesn't come in time. Whatever does come is added
// to the textures to be disposed of.
function loadTexture(url: string, textures: THREE.Texture[]): Promise<THREE.Texture | undefined>
{
    return new Promise(resolve => {
        const timeout = setTimeout(() => resolve(undefined), IMAGE_LOAD_TIMEOUT_MS);
        TextureFactory.createDetachedImageTexture(url)
            .then(texture => {
                textures.push(texture);
                resolve(texture);
            })
            .catch(err => {
                console.warn(`RoomPreviewUtil :: Failed to load an image (url = ${url}):`, err);
                resolve(undefined);
            })
            .finally(() => clearTimeout(timeout));
    });
}

// Puts the upper level, if there is one, clear of the lower: beside it, behind it along x with their floors
// level, or straight over it, whichever shows the room larger in a picture no wider for its height than
// maxAspectRatio. Returns what the levels then cover of the picture's plane, in world units along its axes.
function placeLevels(levels: RoomPreviewLevel[], maxAspectRatio: number): {min: Vec2, max: Vec2}
{
    for (const level of levels)
    {
        // (An empty level still has somewhere to be.)
        if (level.bounds.isEmpty())
            level.bounds.set(new THREE.Vector3(0, 0, 0), new THREE.Vector3(MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z));
    }
    if (levels.length < 2)
        return getScreenRect(levels);

    const [lower, upper] = levels;
    const lowerRect = getScreenRect([lower]);
    const upperRect = getScreenRect([upper]);
    const beside = new THREE.Vector3(
        (viewDir.x > 0) ? lower.bounds.min.x - upper.bounds.max.x - LEVEL_GAP
            : lower.bounds.max.x - upper.bounds.min.x + LEVEL_GAP,
        -(upper.layerMin + 1) * COLLISION_LAYER_HEIGHT, 0);
    const above = new THREE.Vector3(0, (lowerRect.max.y - upperRect.min.y) / screenUp.y + LEVEL_GAP, 0);

    upper.group.position.copy(above);
    const aboveRect = getScreenRect(levels);
    upper.group.position.copy(beside);
    const besideRect = getScreenRect(levels);
    if (getScaleToFit(besideRect, maxAspectRatio) >= getScaleToFit(aboveRect, maxAspectRatio))
        return besideRect;
    upper.group.position.copy(above);
    return aboveRect;
}

// How large a rect is shown in a picture of a height of one and a width of aspectRatio.
function getScaleToFit(rect: {min: Vec2, max: Vec2}, aspectRatio: number): number
{
    return Math.min(aspectRatio / (rect.max.x - rect.min.x), 1 / (rect.max.y - rect.min.y));
}

// What the levels cover of the picture's plane, where they now are.
function getScreenRect(levels: RoomPreviewLevel[]): {min: Vec2, max: Vec2}
{
    const min = {x: Infinity, y: Infinity};
    const max = {x: -Infinity, y: -Infinity};
    for (const level of levels)
    {
        for (let corner = 0; corner < 8; ++corner)
        {
            vec3Temp.set((corner & 1) ? level.bounds.max.x : level.bounds.min.x,
                (corner & 2) ? level.bounds.max.y : level.bounds.min.y,
                (corner & 4) ? level.bounds.max.z : level.bounds.min.z).add(level.group.position);
            const x = vec3Temp.dot(screenRight), y = vec3Temp.dot(screenUp);
            min.x = Math.min(min.x, x);
            min.y = Math.min(min.y, y);
            max.x = Math.max(max.x, x);
            max.y = Math.max(max.y, y);
        }
    }
    return {min, max};
}

// A camera whose picture, width x height in world units, has the middle of the given rect at its own.
function createCamera(contentRect: {min: Vec2, max: Vec2}, width: number, height: number): THREE.OrthographicCamera
{
    // Far enough back to have the whole of any room in front of it.
    const distance = 4 * Math.hypot(MAX_ROOM_X, MAX_ROOM_Y, MAX_ROOM_Z);
    const camera = new THREE.OrthographicCamera(-0.5 * width, 0.5 * width, 0.5 * height, -0.5 * height,
        0, 2 * distance);
    camera.quaternion.copy(viewQuaternion);
    camera.position.copy(screenRight).multiplyScalar(0.5 * (contentRect.min.x + contentRect.max.x))
        .addScaledVector(screenUp, 0.5 * (contentRect.min.y + contentRect.max.y))
        .addScaledVector(viewDir, distance);
    camera.updateMatrixWorld();
    return camera;
}

// Renders the scene into the target and reads it back, top row first.
async function draw(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
    target: THREE.WebGLRenderTarget): Promise<ImageData>
{
    // Its shaders are compiled for the target first, off the game's frames. The target is let go of at once,
    // since the game goes on drawing meanwhile.
    const gameTarget = renderer.getRenderTarget();
    let compiled: Promise<unknown>;
    try
    {
        renderer.setRenderTarget(target);
        compiled = renderer.compileAsync(scene, camera);
    }
    finally
    {
        renderer.setRenderTarget(gameTarget);
    }
    // (With the context lost meanwhile, they would never be ready.)
    await Promise.race([compiled, new Promise(resolve => setTimeout(resolve, SHADER_COMPILE_TIMEOUT_MS))]);
    if (renderer.getContext().isContextLost())
        throw new Error("RoomPreviewUtil :: The graphics context was lost.");

    const {width, height} = target;
    const pixels = new Uint8Array(width * height * 4);
    try
    {
        renderer.setRenderTarget(target);
        LightBlockMapMaterialUtil.drawWithoutLamps(() => renderer.render(scene, camera));
        renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    }
    finally
    {
        renderer.setRenderTarget(gameTarget);
    }

    // (Read back bottom row first.)
    const image = new ImageData(width, height);
    const rowLength = width * 4;
    for (let row = 0; row < height; ++row)
        image.data.set(pixels.subarray((height - 1 - row) * rowLength, (height - row) * rowLength), row * rowLength);
    return image;
}

// Writes its name by each level of a room shown as more than one: over the level's far wall on the picture's left,
// which nothing of the room stands above. Lettered by a 2D canvas no larger than a name, in the font the game's
// page is set in, rather than by the renderer, which would take a texture and a shader for it.
function writeLevelNames(image: ImageData, levels: RoomPreviewLevel[], camera: THREE.Camera, pixelRatio: number): void
{
    const ctx = (levels.length > 1) ? document.createElement("canvas").getContext("2d", {willReadFrequently: true}) : null;
    if (!ctx)
        return;
    const fontSize = Math.round(LEVEL_NAME_FONT_SIZE * pixelRatio);
    const margin = Math.round(LEVEL_NAME_MARGIN * pixelRatio);
    const font = `${fontSize}px ${getComputedStyle(GraphicsManager.getGameCanvas()).fontFamily}`;

    levels.forEach((level, i) => {
        const name = LEVEL_NAMES[i];
        // The top of that wall, in the picture's pixels: from the leftmost corner of the level's top to the highest.
        const corners = [0, 1, 2, 3].map(corner => {
            vec3Temp.set((corner & 1) ? level.bounds.max.x : level.bounds.min.x, level.bounds.max.y,
                (corner & 2) ? level.bounds.max.z : level.bounds.min.z).add(level.group.position).project(camera);
            return {x: 0.5 * (1 + vec3Temp.x) * image.width, y: 0.5 * (1 - vec3Temp.y) * image.height};
        });
        const nearEnd = corners.reduce((a, b) => (b.x < a.x) ? b : a);
        const farCorner = corners.reduce((a, b) => (b.y < a.y) ? b : a);

        // The name's box, margin and all: its bottom right corner on the wall's top, and all of it in the picture.
        ctx.font = font;
        const width = Math.min(image.width, Math.ceil(ctx.measureText(name).width) + 2 * margin);
        const height = Math.min(image.height, fontSize + 2 * margin);
        const x = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(nearEnd.x, farCorner.x, LEVEL_NAME_PLACE)) - width,
            0, image.width - width);
        const y = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(nearEnd.y, farCorner.y, LEVEL_NAME_PLACE)) - height,
            0, image.height - height);

        // Written over what the picture shows there, edged in the background's color in case that is the room.
        ctx.canvas.width = width;
        ctx.canvas.height = height;
        ctx.putImageData(image, -x, -y, x, y, width, height);
        ctx.font = font;
        ctx.textAlign = "right";
        ctx.lineJoin = "round";
        ctx.lineWidth = 0.5 * margin;
        ctx.strokeStyle = BACKGROUND_COLOR;
        ctx.strokeText(name, width - margin, height - margin);
        ctx.fillStyle = LEVEL_NAME_COLOR;
        ctx.fillText(name, width - margin, height - margin);
        const lettered = ctx.getImageData(0, 0, width, height).data;
        for (let row = 0; row < height; ++row)
            image.data.set(lettered.subarray(row * width * 4, (row + 1) * width * 4), ((y + row) * image.width + x) * 4);
    });
}

export default RoomPreviewUtil;
