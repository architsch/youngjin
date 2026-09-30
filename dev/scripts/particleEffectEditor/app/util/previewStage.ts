import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Vec3 from "../../../../../src/shared/math/types/vec3";
import WaveformUtil from "../../../../../src/shared/math/util/waveformUtil";
import ParticleSystem from "../../../../../src/client/graphics/particle/particleSystem";
import ParticleEffectConfig from "../../../../../src/client/graphics/particle/types/particleEffectConfig";
import ParticleEmitterHandle from "../../../../../src/client/graphics/particle/types/particleEmitterHandle";
import ParticleAtlasUtil from "../../../../../src/client/graphics/particle/util/particleAtlasUtil";
import ParticleEffectConfigUtil from "../../../../../src/client/graphics/particle/util/particleEffectConfigUtil";
import ParticleMaterialUtil from "../../../../../src/client/graphics/particle/util/particleMaterialUtil";
import ParticleParamTextureUtil from "../../../../../src/client/graphics/particle/util/particleParamTextureUtil";
import AtmosphereMaterialUtil from "../../../../../src/client/graphics/util/atmosphereMaterialUtil";
import AppStandIn from "../standIns/appStandIn";
import GraphicsManagerStandIn from "../standIns/graphicsManagerStandIn";
import ParticleEffectConfigMapStandIn from "../standIns/particleEffectConfigMapStandIn";
import PreviewSettings from "../types/previewSettings";
import PreviewStatus from "../types/previewStatus";

// The room cell effects play in, clear of the room's edges; its floor is y = 0 (see AppStandIn).
const CELL_ROW = 16;
const CELL_COL = 16;
const ORIGIN_X = CELL_COL + 0.5;
const ORIGIN_Z = CELL_ROW + 0.5;
const WALL_Z = CELL_ROW;
const UP: Vec3 = {x: 0, y: 1, z: 0};
const FLOOR_COLORS = {light: 0xa0a8b8, dark: 0x4a3a2c};
const BACKGROUND_COLOR = 0x1c2026;
const SCRUB_STEP_SECONDS = 1 / 120;
// A frame held longer than this (a tab in the background) doesn't throw the effect ahead.
const MAX_FRAME_SECONDS = 0.1;
const LOOP_PAUSE_SECONDS = 0.5;
// An edit replays a one-shot effect once edits pause, so a slider drag isn't a stream of restarts.
const REPLAY_DELAY_MS = 350;
const STATUS_INTERVAL_MS = 100;

const sizeTemp = new THREE.Vector2();

// Plays one effect through the game's own particle system and shader (GraphicsManager, App and the effect map
// stood in for; see server.js), where the game would play it. An edit is baked into the parameter texture,
// which particles already alive read at once; what is drawn at their birth shows on the replay that follows.
export default class PreviewStage
{
    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene = GraphicsManagerStandIn.getScene();
    private readonly camera = GraphicsManagerStandIn.getCamera();
    private readonly controls: OrbitControls;
    private readonly floorMaterial: THREE.MeshLambertMaterial;
    private readonly block: THREE.Mesh;
    private readonly wall: THREE.Mesh;
    private readonly onStatus: (status: PreviewStatus) => void;
    private settings: PreviewSettings;
    private effects: {[effect: string]: ParticleEffectConfig} = {};
    // Those without problems: one naming no atlas sprite would stop the whole bake.
    private bakedEffects: {[effect: string]: ParticleEffectConfig} = {};
    private effect = "";
    private mode: "oneShot" | "emitter" = "oneShot";
    private rowLayout = "";
    private emitter: ParticleEmitterHandle | undefined;
    private time = 0;
    private frozen = false;
    private random = createRandom(1);
    private readonly warnings = new Set<string>();
    private loaded = false;
    private disposed = false;
    private frameId = 0;
    private lastFrameTime = 0;
    private lastStatusTime = 0;
    private replayTimer: number | undefined;

    constructor(canvas: HTMLCanvasElement, settings: PreviewSettings, onStatus: (status: PreviewStatus) => void)
    {
        this.settings = settings;
        this.onStatus = onStatus;
        // Nothing to bake yet, so the particle system's own first bake can't fail.
        ParticleEffectConfigMapStandIn.setConfigs({});

        this.renderer = new THREE.WebGLRenderer({canvas, antialias: true});
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.scene.background = new THREE.Color(BACKGROUND_COLOR);
        this.scene.fog = new THREE.Fog(BACKGROUND_COLOR, 30, 60);
        AtmosphereMaterialUtil.setSmoke(0, 1, 0, {x: 0, y: 0, z: 0});
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(0.6, 1, 0.8);
        this.scene.add(sun);

        // Grid lines on whole units, as the voxel grid runs.
        this.floorMaterial = new THREE.MeshLambertMaterial({map: createGridTexture()});
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), this.floorMaterial);
        floor.rotation.x = -0.5 * Math.PI;
        floor.position.set(CELL_COL, 0, CELL_ROW);
        this.block = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshLambertMaterial({color: 0x9aa3b8}));
        this.block.position.set(ORIGIN_X, 0.25, ORIGIN_Z);
        this.wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), new THREE.MeshLambertMaterial({color: 0x8a8174}));
        this.wall.position.set(CELL_COL, 4, WALL_Z);
        this.scene.add(floor, this.block, this.wall);

        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.15;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 25;
        this.controls.maxPolarAngle = 0.495 * Math.PI;
    }

    async start(): Promise<void>
    {
        await ParticleSystem.load();
        if (this.disposed)
            return;
        this.loaded = true;
        this.applyScene();
        this.resetCamera();
        this.rebake();
        this.restart();
        this.frameId = requestAnimationFrame(this.onFrame);
    }

    dispose(): void
    {
        this.disposed = true;
        cancelAnimationFrame(this.frameId);
        window.clearTimeout(this.replayTimer);
        this.stopEmitter();
        this.controls.dispose();
        this.renderer.dispose();
    }

    setEffects(effects: {[effect: string]: ParticleEffectConfig}): void
    {
        this.effects = effects;
        if (!this.loaded)
            return;
        const wasBaked = this.effect in this.bakedEffects;
        const rowsMoved = this.rebake();
        if (rowsMoved || !wasBaked || !(this.effect in this.bakedEffects) || this.getMode() != this.mode)
        {
            this.restartAtTimeline();
            return;
        }
        if (this.emitter != undefined)
        {
            // Its handle holds the effect as it was; a fresh one carries the stream on.
            this.stopEmitter();
            this.capture(() => this.startEmitter(false));
        }
        else if (this.frozen)
            this.scrubTo(this.time);
        else
            this.scheduleReplay();
    }

    setEffect(effect: string): void
    {
        if (effect == this.effect)
            return;
        this.effect = effect;
        this.frozen = false;
        if (this.loaded)
            this.restart();
    }

    setSettings(settings: PreviewSettings): void
    {
        const previous = this.settings;
        this.settings = settings;
        if (!this.loaded)
            return;
        if (settings.scene != previous.scene || settings.darkFloor != previous.darkFloor)
            this.applyScene();
        if (settings.scene != previous.scene)
            this.resetCamera();
        if (settings.scene != previous.scene || settings.mode != previous.mode || settings.scale != previous.scale
            || settings.seed != previous.seed)
            this.restartAtTimeline();
        else if (!WaveformUtil.equals(settings.level, previous.level))
            this.emitter?.setLevel(settings.level);
    }

    replay(): void
    {
        this.frozen = false;
        this.restart();
    }

    resume(): void
    {
        this.frozen = false;
    }

    // Held at that moment of a one-shot effect, replayed from its start with the same particles.
    scrubTo(time: number): void
    {
        this.restart();
        this.frozen = true;
        let elapsed = 0;
        this.capture(() =>
        {
            while (elapsed < time - 1e-9)
            {
                const step = Math.min(SCRUB_STEP_SECONDS, time - elapsed);
                ParticleSystem.update(step);
                elapsed += step;
            }
        });
        this.time = time;
    }

    resetCamera(): void
    {
        const {position} = this.getPlacement();
        const offset = (this.settings.scene == "wall") ? {x: 1.3, y: 0.35, z: 3.2} : {x: 1.9, y: 1.85, z: 2.5};
        this.controls.target.set(position.x, position.y, position.z);
        this.camera.position.set(position.x + offset.x, position.y + offset.y, position.z + offset.z);
        this.controls.update();
        this.camera.updateMatrixWorld(true);
    }

    private readonly onFrame = (now: number): void =>
    {
        if (this.disposed)
            return;
        const deltaTime = (this.lastFrameTime > 0) ? Math.min((now - this.lastFrameTime) / 1000, MAX_FRAME_SECONDS) : 0;
        this.lastFrameTime = now;
        this.resize();
        this.controls.update();
        if (!this.frozen)
            this.advance(deltaTime * this.settings.speed);
        this.renderer.render(this.scene, this.camera);
        if (now - this.lastStatusTime >= STATUS_INTERVAL_MS)
        {
            this.lastStatusTime = now;
            this.onStatus(this.getStatus());
        }
        this.frameId = requestAnimationFrame(this.onFrame);
    };

    private advance(deltaTime: number): void
    {
        this.capture(() => ParticleSystem.update(deltaTime));
        this.time += deltaTime;
        if (this.settings.loop && this.mode == "oneShot" && this.time > this.getDuration() + LOOP_PAUSE_SECONDS)
            this.restart();
    }

    // From the effect's start, with the seed's particles.
    private restart(): void
    {
        window.clearTimeout(this.replayTimer);
        this.stopEmitter();
        this.capture(() => ParticleSystem.unload());
        this.warnings.clear();
        this.time = 0;
        this.random = createRandom(this.settings.seed);
        this.mode = this.getMode();
        if (!(this.effect in this.bakedEffects))
            return;
        const {position, direction} = this.getPlacement();
        this.capture(() =>
        {
            // play() culls by the camera's frustum, which update() reads.
            ParticleSystem.update(0);
            if (this.mode == "emitter")
                this.startEmitter(true);
            else
                ParticleSystem.play(this.effect, position, {direction, scale: this.settings.scale});
        });
    }

    private restartAtTimeline(): void
    {
        if (this.frozen && this.getMode() == "oneShot")
            this.scrubTo(this.time);
        else
        {
            this.frozen = false;
            this.restart();
        }
    }

    private scheduleReplay(): void
    {
        window.clearTimeout(this.replayTimer);
        this.replayTimer = window.setTimeout(() =>
        {
            if (!this.frozen && !this.disposed)
                this.restart();
        }, REPLAY_DELAY_MS);
    }

    // prewarm: the stream full from the start, as when an emitter comes into view in the game.
    private startEmitter(prewarm: boolean): void
    {
        const emitter = ParticleSystem.createEmitter(this.effect);
        if (emitter == undefined)
            return;
        const {position, direction} = this.getPlacement();
        emitter.setPose(position, direction);
        emitter.setScales(1, 1, this.settings.scale);
        emitter.setLevel(this.settings.level);
        if (!prewarm)
        {
            emitter.wasInView = true;
            emitter.burstPending = false;
        }
        this.emitter = emitter;
    }

    // Its particles already in flight live out their lives.
    private stopEmitter(): void
    {
        this.emitter?.stop();
        this.emitter = undefined;
    }

    // Whether rows moved (an effect or layer came or went), leaving particles alive reading the wrong ones.
    private rebake(): boolean
    {
        this.bakedEffects = Object.fromEntries(Object.entries(this.effects)
            .filter(([, config]) => ParticleEffectConfigUtil.getProblems(config).length == 0));
        ParticleEffectConfigMapStandIn.setConfigs(this.bakedEffects);
        this.capture(() => ParticleMaterialUtil.setTextures(ParticleAtlasUtil.build(), ParticleParamTextureUtil.bake()));
        const rowLayout = Object.entries(this.bakedEffects)
            .map(([effect, config]) => `${effect}:${config.layers.length}`).join(",");
        const rowsMoved = rowLayout != this.rowLayout;
        this.rowLayout = rowLayout;
        return rowsMoved;
    }

    private applyScene(): void
    {
        const scene = this.settings.scene;
        this.block.visible = (scene == "block");
        this.wall.visible = (scene == "wall");
        AppStandIn.setBlock(CELL_ROW, CELL_COL, 0, scene == "block");
        this.floorMaterial.color.setHex(this.settings.darkFloor ? FLOOR_COLORS.dark : FLOOR_COLORS.light);
    }

    // Where the game plays such an effect: a block's middle for a block's (see ParticleTriggerUtil), just in
    // front of a wall for an object's on it, or in the air.
    private getPlacement(): {position: Vec3, direction: Vec3}
    {
        switch (this.settings.scene)
        {
            case "wall":
                return {position: {x: ORIGIN_X, y: 1.25, z: WALL_Z + 0.1 * this.settings.scale},
                    direction: {x: 0, y: 0, z: 1}};
            case "air":
                return {position: {x: ORIGIN_X, y: 1.5, z: ORIGIN_Z}, direction: UP};
            default:
                return {position: {x: ORIGIN_X, y: 0.25, z: ORIGIN_Z}, direction: UP};
        }
    }

    // "auto": from an emitter if a layer emits at a rate without end, as only an emitter would run it.
    private getMode(): "oneShot" | "emitter"
    {
        if (this.settings.mode != "auto")
            return this.settings.mode;
        const layers = this.effects[this.effect]?.layers ?? [];
        return layers.some(layer => (layer.rate ?? 0) > 0 && !((layer.duration ?? 0) > 0)) ? "emitter" : "oneShot";
    }

    // Until the last particle of a one-shot effect dies.
    private getDuration(): number
    {
        const layers = this.effects[this.effect]?.layers ?? [];
        return Math.max(0, ...layers.map(layer =>
            (layer.duration ?? 0) + (Array.isArray(layer.lifetime) ? layer.lifetime[1] : 0)));
    }

    private getStatus(): PreviewStatus
    {
        const stats = ParticleSystem.getStats();
        // A batch is drawn whole whenever it is visible (it is never frustum-culled).
        const batchDrawCalls = this.scene.children.filter(child => child instanceof THREE.Mesh && child.visible
            && child.geometry instanceof THREE.InstancedBufferGeometry).length;
        return {
            mode: this.mode,
            previewable: this.effect in this.bakedEffects,
            time: this.time,
            duration: (this.mode == "oneShot") ? this.getDuration() : 0,
            frozen: this.frozen,
            particles: stats.particles,
            overwrites: stats.overwrites,
            drawCalls: batchDrawCalls,
            warnings: [...this.warnings],
        };
    }

    private resize(): void
    {
        const canvas = this.renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const size = this.renderer.getSize(sizeTemp);
        if (width == 0 || height == 0 || (size.x == width && size.y == height))
            return;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    // Particle system calls, drawing the seed's random numbers and keeping what they log.
    private capture(run: () => void): void
    {
        const random = Math.random;
        const warn = console.warn;
        Math.random = this.random;
        console.warn = (...args: unknown[]) =>
        {
            this.warnings.add(args.map(String).join(" "));
            warn(...args);
        };
        try
        {
            run();
        }
        catch (err)
        {
            this.warnings.add(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
        finally
        {
            Math.random = random;
            console.warn = warn;
        }
    }
}

// Mulberry32: small, fast, and the same numbers for the same seed.
function createRandom(seed: number): () => number
{
    let state = seed | 0;
    return () =>
    {
        state = (state + 0x6D2B79F5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function createGridTexture(): THREE.Texture
{
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#d2d2d2";
    ctx.fillRect(0, 0, 128, 2);
    ctx.fillRect(0, 0, 2, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
