import * as THREE from "three";
import GameObject from "./gameObject";
import InstancedMeshGraphics from "../../components/instancedMeshGraphics";
import MeshFactory from "../../../graphics/factories/meshFactory";
import GraphicsManager from "../../../graphics/graphicsManager";
import PointerCoordUtil from "../../../graphics/util/pointerCoordUtil";
import ClientInventoryManager from "../../../inventory/clientInventoryManager";
import { objectCollectedObservable } from "../../../system/clientObservables";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import ObjectWaypoint from "../../../../shared/object/types/objectWaypoint";
import ObjectCategoryConfigMap from "../../../../shared/object/maps/objectCategoryConfigMap";
import DollarBillObjectTypeConfig, { DOLLAR_BILL_LENGTH, DOLLAR_BILL_REST_HEIGHT, DOLLAR_BILL_REST_SLOPE,
    DOLLAR_BILL_WIDTH } from "../../../../shared/object/types/objectTypeConfig/dollarBillObjectTypeConfig";
import ObjectPathUtil from "../../../../shared/object/util/objectPathUtil";
import DollarBillPoseUtil from "../../util/dollarBillPoseUtil";
import InstancedTexturePackMaterialParams from "../../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import MeshDataUtil from "../../../../shared/graphics/mesh/util/meshDataUtil";
import StringUtil from "../../../../shared/math/util/stringUtil";
import Vec2 from "../../../../shared/math/types/vec2";
import Vec3 from "../../../../shared/math/types/vec3";
import Vector3DUtil from "../../../../shared/math/util/vector3DUtil";
import dollarBillImageDataUrl from "../../../../../public/app/assets/resources/DollarBill/dollarBill.webp";

const GEOMETRY_ID = "Square";
// The note's face, the two halves of it side by side, each a cell of its own.
const TEXTURE_WIDTH = 320;
const TEXTURE_HEIGHT = 137;
const NUM_HALVES = 2;
const MAX_INSTANCES = NUM_HALVES * ObjectCategoryConfigMap.getMaxCountPerRoom(DollarBillObjectTypeConfig.category);

const materialParams = createMaterialParams("dollarBill");
const INSTANCED_MESH_ID = MeshDataUtil.getInstancedMeshId(GEOMETRY_ID, materialParams.getMaterialId());
// The same bill, which nothing can hide or darken, for one flying to the user's count (see takeOff).
const overRoomMaterialParams = createMaterialParams("dollarBillOverRoom");
overRoomMaterialParams.overRoom = true;
const OVER_ROOM_MESH_ID = MeshDataUtil.getInstancedMeshId(GEOMETRY_ID, overRoomMaterialParams.getMaterialId());

// How quickly the wind on it, and its pose, follow what they are coming to, a share a second. The wind dies down over the
// last of a flight, so that it comes to rest as it lands, and it is left to settle this long after.
const WIND_RATE = 9;
const WIND_DYING_SECONDS = 0.6;
const POSE_RATE = 7;
const SETTLE_SECONDS = 1;
// How quickly the bill as drawn follows where it is, a share a second, which rounds off its path's corners.
const FOLLOW_RATE = 14;
// Told to be this far from where it is, it was away from the page: it starts over from there, not across the room.
const MAX_DRIFT = 2;
// Resting tipped over, one half lies flat on what it lies on, this far over it, and the other rises from the crease by
// this many radians, like a card a little open. The crease is then at one side of what the bill covers, which stays
// around where it is, and each half slopes this much from it, measured as they are standing.
const FLAT_CLEARANCE = 0.012;
const FLAT_OPENING = 0.6;
const FLAT_SLOPE = 0.5 * (Math.PI - FLAT_OPENING);
const FLAT_ROLL = Math.PI - FLAT_SLOPE;
const FLAT_ASIDE = 0.25 * DOLLAR_BILL_LENGTH;
const FLAT_DROP = DOLLAR_BILL_REST_HEIGHT - FLAT_CLEARANCE;
// In a full wind, how it opens and shuts: the slope of its halves about their slope at rest, in radians, swinging at two
// rates at once so that no two flaps match. The halves never lie flatter than a sliver of a fold, nor close up.
const WIND_SLOPE = -0.1;
const FLAP_SWING = 0.5;
const FLAP_RATE = 15;
const FLUTTER_SWING = 0.16;
const FLUTTER_RATE = 37;
const MIN_SLOPE = 0.05;
const MAX_SLOPE = 1.35;
// In a full wind, how it tumbles and shakes as a whole: its pitch and roll in radians, its turning in radians a second,
// how far it wanders about where it is, in world units, each at a rate of its own (in radians a second), and how far over
// where it is it rides, to clear the floor it skids along.
const PITCH_SWING = 0.6;
const PITCH_RATE = 5.3;
const ROLL_SWING = 0.75;
const ROLL_RATE = 6.7;
const MAX_TURN_RATE = 2.5;
const SHAKE_SIZE = 0.09;
const SHAKE_RATE_X = 7.1;
const SHAKE_RATE_Y = 9.3;
const SHAKE_RATE_Z = 5.9;
const WIND_RIDE = 0.15;
// It unfolds into the room over this long.
const APPEAR_SECONDS = 0.25;
// Collected by someone else, it is drawn into their body over this long, spinning at this rate, in radians a second.
export const ABSORB_SECONDS = 0.5;
const ABSORB_SPIN = 7;
// Collected by the user, it flies to the count this long, drawn this far ahead of the camera, over the room whatever
// stands there. By this share of the flight it has turned to face them, and it turns about that way by this much, in
// radians, as it goes, tumbling by this much either way.
export const COUNT_FLIGHT_SECONDS = 0.85;
const COUNT_FLIGHT_DEPTH = 2.2;
const FACING_SHARE = 0.35;
const FLIGHT_SPIN = 2.2;
const FLIGHT_TUMBLE = 0.45;
// Where the count is, in the screen's own units, should the page not have it.
export const COUNT_CORNER: Vec2 = {x: -0.95, y: 0.9};

const bodyMatrixTemp = new THREE.Matrix4();
const halfMatrixTemp = new THREE.Matrix4();
const worldMatrixTemp = new THREE.Matrix4();
const viewedBodyMatrixTemp = new THREE.Matrix4();
const positionTemp = new THREE.Vector3();
const eulerTemp = new THREE.Euler();
const quaternionTemp = new THREE.Quaternion();
const facingQuaternionTemp = new THREE.Quaternion();
const scaleTemp = new THREE.Vector3();
const xAxisTemp = new THREE.Vector3();
const yAxisTemp = new THREE.Vector3();
const zAxisTemp = new THREE.Vector3();
const ndcTemp = new THREE.Vector2();

// A $1 bill folded in half (see DollarBillObjectTypeConfig): each half is one instance of a two-sided quad, showing its
// half of the note. It lies still until the server sets it on a path, which it plays out by itself, flapping and tumbling
// for as long as the wind is on it, all of it in the matrices it writes itself: a pose of a fold that opens and shuts, on a
// body that tumbles, is more than an offset and a facing say. It comes to rest as DollarBillPoseUtil says, standing on its
// two edges or tipped over onto one half, by way of poses of its own, which differ from one screen to the next only while
// it flies. Lying still, it costs nothing. Collected, it outlives its removal from the room: on its collector's screen it
// flies straight to the count, which shows the dollar only as it arrives (see ClientInventoryManager), and on everyone
// else's it is drawn into the collector's body.
export default class DollarBillGameObject extends GameObject
{
    private static flying: Set<DollarBillGameObject> = new Set();

    private instancedMeshGraphics: InstancedMeshGraphics;
    private meshId: string = INSTANCED_MESH_ID;
    private instanceIds: number[] = [];
    private despawned: boolean = false;

    private path: ObjectWaypoint[] = [];
    private nextWaypoint: number = 0;
    private secondsLeft: number = 0;
    // Where it is on its path, as the server keeps it; what is drawn follows.
    private at: Vec3;
    private rest: {yaw: number, lean: number};
    private wind: number = 0;
    private windClock: number;
    private yaw: number;
    // How far it has tipped over, from standing (0) to flat on either half (1 or -1).
    private lean: number;
    private turnRate: number;
    private appeared: number = 0;
    private settling: number = SETTLE_SECONDS;
    // Being drawn into whoever collected it, from where it was.
    private absorption: {seconds: number, from: THREE.Vector3, collector: GameObject | undefined} | undefined;
    // On its way to the count, kept to the screen: where it goes from and to, in the screen's own units, and its size and
    // how it was turned from the camera's way as it set off.
    private flight: {seconds: number, from: Vec2, to: Vec2, size: number, turned: THREE.Quaternion} | undefined;

    // Ahead of any bill, so that the first to come in the middle of a visit doesn't stall a frame on its shader: with the
    // room's other meshes, it is compiled behind the loading screen (see GraphicsManager.precompileSceneShaders).
    static async preload(): Promise<void>
    {
        await InstancedMeshGraphics.loadInstancedMesh(GEOMETRY_ID, materialParams, MAX_INSTANCES, true);
        MeshFactory.stopRaycasting(INSTANCED_MESH_ID);
        await InstancedMeshGraphics.loadInstancedMesh(GEOMETRY_ID, overRoomMaterialParams, MAX_INSTANCES, true);
        MeshFactory.stopRaycasting(OVER_ROOM_MESH_ID);
    }

    // Once the camera has moved this frame, since what flies keeps to the screen.
    static updateFlying(deltaTime: number): void
    {
        if (DollarBillGameObject.flying.size == 0)
            return;
        const camera = GraphicsManager.getCamera();
        camera.updateWorldMatrix(true, false);
        for (const bill of DollarBillGameObject.flying)
        {
            if (bill.flight != undefined)
                bill.flyOn(deltaTime, camera);
            else
                bill.absorb(deltaTime);
        }
    }

    // Those collected arrive at once, the room they flew in being left.
    static landFlying(): void
    {
        for (const bill of DollarBillGameObject.flying)
            bill.land();
    }

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshGraphics = this.components.instancedMeshGraphics as InstancedMeshGraphics;
        if (!this.instancedMeshGraphics)
            throw new Error("DollarBillGameObject requires InstancedMeshGraphics component");

        this.at = {...params.transform.pos};
        this.rest = DollarBillPoseUtil.getRestPose(params.objectId, this.at);
        this.yaw = this.rest.yaw;
        this.lean = this.rest.lean;
        const seed = Math.abs(StringUtil.getHashCode(params.objectId));
        this.windClock = seed % 1000;
        this.turnRate = MAX_TURN_RATE * ((seed % 200) / 100 - 1);
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();
        await DollarBillGameObject.preload();
        if (this.despawned)
            return;

        this.instanceIds = this.rentHalves();
        this.place();
    }

    async onDespawn(): Promise<void>
    {
        this.despawned = true;
        await super.onDespawn();
        // Collected, it goes on from here, on what it draws itself with.
        if (!DollarBillGameObject.flying.has(this))
            this.returnInstances();
    }

    followPath(waypoints: ObjectWaypoint[])
    {
        const start = waypoints[0].pos;
        if (Vector3DUtil.distSqr(this.at, start) > MAX_DRIFT * MAX_DRIFT)
            Object.assign(this.at, start);
        this.path = waypoints;
        this.nextWaypoint = 0;
        this.secondsLeft = ObjectPathUtil.getSeconds(waypoints, this.at);
        this.rest = DollarBillPoseUtil.getRestPose(this.params.objectId, waypoints[waypoints.length - 1].pos);
        this.settling = SETTLE_SECONDS;
    }

    onCollected(collector: GameObject | undefined, byUser: boolean)
    {
        DollarBillGameObject.flying.add(this);
        if (byUser)
            this.takeOff();
        else
            this.absorption = {seconds: 0, from: this.obj.position.clone(), collector};
    }

    update(deltaTime: number)
    {
        if (this.settling <= 0)
            return;

        this.nextWaypoint = ObjectPathUtil.advance(this.path, this.nextWaypoint, this.at, deltaTime);
        if (this.nextWaypoint < this.path.length)
            this.settling = SETTLE_SECONDS;
        else
            this.settling -= deltaTime;
        this.secondsLeft = Math.max(0, this.secondsLeft - deltaTime);
        this.windClock += deltaTime;
        this.appeared = Math.min(1, this.appeared + deltaTime / APPEAR_SECONDS);

        const {position} = this.obj;
        if (this.settling > 0)
        {
            const poseStep = 1 - Math.exp(-POSE_RATE * deltaTime);
            const follow = 1 - Math.exp(-FOLLOW_RATE * deltaTime);
            this.wind += (Math.min(1, this.secondsLeft / WIND_DYING_SECONDS) - this.wind) * (1 - Math.exp(-WIND_RATE * deltaTime));
            this.lean += (this.rest.lean * (1 - this.wind) - this.lean) * poseStep;
            const turn = this.rest.yaw + this.turnRate * this.secondsLeft - this.yaw;
            this.yaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * poseStep;
            position.set(position.x + (this.at.x - position.x) * follow, position.y + (this.at.y - position.y) * follow,
                position.z + (this.at.z - position.z) * follow);
        }
        else
        {
            this.wind = 0;
            this.lean = this.rest.lean;
            this.yaw = this.rest.yaw;
            position.set(this.at.x, this.at.y, this.at.z);
        }
        // Where it is taken from for what plays as it goes (see ParticleTriggerUtil).
        Object.assign(this.params.transform.pos, {x: position.x, y: position.y, z: position.z});
        this.place();
    }

    // Into its collector as they are now, tumbling as in a full wind, to show what it was worth once there.
    private absorb(deltaTime: number): void
    {
        const absorption = this.absorption!;
        absorption.seconds += deltaTime;
        const share = Math.min(1, absorption.seconds / ABSORB_SECONDS);
        const {from, collector} = absorption;
        const to = collector?.obj.position ?? from;
        const step = DollarBillPoseUtil.getAbsorptionStep(share);
        this.obj.position.set(from.x + (to.x - from.x) * step.across, from.y + (to.y - from.y) * step.up,
            from.z + (to.z - from.z) * step.across);
        if (share >= 1)
        {
            const {x, y, z} = this.obj.position;
            Object.assign(this.params.transform.pos, {x, y, z});
            objectCollectedObservable.set(this.params);
            this.land();
            return;
        }

        this.catchWind(deltaTime);
        this.yaw += ABSORB_SPIN * deltaTime;
        this.place(step.size);
    }

    // From where the bill is on the screen, or over the edge nearest it, should it be out of view. A scene scaled about its
    // camera looks no different, so at the size that makes up for the depth it flies at, the bill looks just as it did.
    private takeOff(): void
    {
        ClientInventoryManager.onDollarTakingOff();
        const camera = GraphicsManager.getCamera();
        camera.updateWorldMatrix(true, false);
        this.getBodyPosition(positionTemp).applyMatrix4(camera.matrixWorldInverse);
        const {elements} = camera.projectionMatrix;
        const depth = -positionTemp.z;
        this.flight = {seconds: 0, from: DollarBillPoseUtil.getFlightStart(positionTemp.x * elements[0],
            positionTemp.y * elements[5], depth), to: getCountOnScreen(),
            size: COUNT_FLIGHT_DEPTH / Math.max(COUNT_FLIGHT_DEPTH, depth),
            turned: camera.getWorldQuaternion(quaternionTemp).invert().multiply(this.getTurn(facingQuaternionTemp)).clone()};
        this.returnInstances();
        this.meshId = OVER_ROOM_MESH_ID;
        this.instanceIds = this.rentHalves();
    }

    private flyOn(deltaTime: number, camera: THREE.PerspectiveCamera): void
    {
        const flight = this.flight!;
        flight.seconds += deltaTime;
        const share = flight.seconds / COUNT_FLIGHT_SECONDS;
        if (share >= 1)
        {
            this.land();
            return;
        }

        this.catchWind(deltaTime);
        const step = DollarBillPoseUtil.getFlightStep(share, flight.from, flight.to, flight.size);
        const {elements} = camera.projectionMatrix;
        positionTemp.set(step.x * COUNT_FLIGHT_DEPTH / elements[0], step.y * COUNT_FLIGHT_DEPTH / elements[5], -COUNT_FLIGHT_DEPTH);
        const clock = this.windClock;
        eulerTemp.set(0.5 * Math.PI + FLIGHT_TUMBLE * Math.sin(clock * PITCH_RATE), FLIGHT_SPIN * share,
            FLIGHT_TUMBLE * Math.sin(clock * ROLL_RATE));
        quaternionTemp.slerpQuaternions(flight.turned, facingQuaternionTemp.setFromEuler(eulerTemp),
            Math.min(1, share / FACING_SHARE));
        bodyMatrixTemp.compose(positionTemp, quaternionTemp, scaleTemp.setScalar(step.size));
        viewedBodyMatrixTemp.multiplyMatrices(camera.matrixWorld, bodyMatrixTemp);
        this.placeHalves(viewedBodyMatrixTemp, this.getSlope(Math.abs(this.lean), this.wind));
    }

    // Taken up, it leaves off how it lay for how it flaps in a full wind.
    private catchWind(deltaTime: number): void
    {
        this.windClock += deltaTime;
        const windStep = 1 - Math.exp(-WIND_RATE * deltaTime);
        this.wind += (1 - this.wind) * windStep;
        this.lean -= this.lean * windStep;
    }

    // The end of it all, at whatever point it had reached.
    private land(): void
    {
        DollarBillGameObject.flying.delete(this);
        this.returnInstances();
        if (this.flight != undefined)
            ClientInventoryManager.onDollarArrived();
        this.absorption = undefined;
        this.flight = undefined;
    }

    private returnInstances(): void
    {
        for (const instanceId of this.instanceIds)
            this.instancedMeshGraphics.returnInstanceToPool(this.meshId, instanceId);
        this.instanceIds = [];
    }

    // As many of its halves as there are instances left of them: an exhausted pool (bills still going as others come)
    // leaves it undrawn.
    private rentHalves(): number[]
    {
        const instanceIds: number[] = [];
        for (let half = 0; half < NUM_HALVES; ++half)
        {
            const instanceId = this.instancedMeshGraphics.rentInstanceFromPool(this.meshId);
            if (instanceId == undefined)
                break;
            instanceIds.push(instanceId);
            this.instancedMeshGraphics.updateInstanceTextureRect(this.meshId, instanceId,
                half * 0.5 * TEXTURE_WIDTH, 0, 0.5 * TEXTURE_WIDTH, TEXTURE_HEIGHT);
        }
        return instanceIds;
    }

    private place(size: number = this.appeared * (2 - this.appeared)): void
    {
        bodyMatrixTemp.compose(this.getBodyPosition(positionTemp), this.getTurn(quaternionTemp), scaleTemp.set(size, size, size));
        this.placeHalves(bodyMatrixTemp, this.getSlope(Math.abs(this.lean), this.wind));
    }

    // Where its body is in the room.
    private getBodyPosition(out: THREE.Vector3): THREE.Vector3
    {
        const clock = this.windClock;
        const {x, y, z} = this.obj.position;
        const aside = -this.lean * FLAT_ASIDE;
        return out.set(x + aside * Math.cos(this.yaw) + this.wind * SHAKE_SIZE * Math.sin(clock * SHAKE_RATE_X),
            y - Math.abs(this.lean) * FLAT_DROP + this.wind * (WIND_RIDE + SHAKE_SIZE * Math.sin(clock * SHAKE_RATE_Y)),
            z - aside * Math.sin(this.yaw) + this.wind * SHAKE_SIZE * Math.sin(clock * SHAKE_RATE_Z));
    }

    // How its body is turned in the room.
    private getTurn(out: THREE.Quaternion): THREE.Quaternion
    {
        const clock = this.windClock;
        eulerTemp.set(this.wind * PITCH_SWING * Math.sin(clock * PITCH_RATE), this.yaw,
            this.lean * FLAT_ROLL + this.wind * ROLL_SWING * Math.sin(clock * ROLL_RATE));
        return out.setFromEuler(eulerTemp);
    }

    // How steeply its halves slope from the crease.
    private getSlope(flatness: number, wind: number): number
    {
        const clock = this.windClock;
        return Math.max(MIN_SLOPE, Math.min(MAX_SLOPE, DOLLAR_BILL_REST_SLOPE
            + flatness * (FLAT_SLOPE - DOLLAR_BILL_REST_SLOPE) + wind * (WIND_SLOPE
            + FLAP_SWING * Math.sin(clock * FLAP_RATE) + FLUTTER_SWING * Math.sin(clock * FLUTTER_RATE))));
    }

    // The matrices of a body's halves: each hangs from the crease, along the body's z, as the two slopes of a roof, which
    // tipped over onto one of them has the crease down at one side.
    private placeHalves(body: THREE.Matrix4, slope: number): void
    {
        if (this.instanceIds.length < NUM_HALVES)
            return;

        const across = Math.cos(slope), down = Math.sin(slope);
        for (let half = 0; half < NUM_HALVES; ++half)
        {
            const side = 2 * half - 1;
            xAxisTemp.set(across, -side * down, 0).multiplyScalar(0.5 * DOLLAR_BILL_LENGTH);
            yAxisTemp.set(0, 0, -DOLLAR_BILL_WIDTH);
            zAxisTemp.set(side * down, across, 0);
            halfMatrixTemp.makeBasis(xAxisTemp, yAxisTemp, zAxisTemp).setPosition(0.25 * DOLLAR_BILL_LENGTH * side * across,
                -0.25 * DOLLAR_BILL_LENGTH * down, 0);
            worldMatrixTemp.multiplyMatrices(body, halfMatrixTemp);
            this.instancedMeshGraphics.updateInstanceMatrix(this.meshId, this.instanceIds[half], worldMatrixTemp);
        }
    }
}

function createMaterialParams(customMaterialId: string): InstancedTexturePackMaterialParams
{
    const params = new InstancedTexturePackMaterialParams(dollarBillImageDataUrl, TEXTURE_WIDTH, TEXTURE_HEIGHT,
        0.5 * TEXTURE_WIDTH, TEXTURE_HEIGHT, "staticImageFromPath");
    // In place of an id spelling the whole image out.
    params.customMaterialId = customMaterialId;
    params.doubleSided = true;
    params.photographic = true;
    return params;
}

// The middle of the icon at the head of the count, in the screen's own units.
function getCountOnScreen(): Vec2
{
    const rect = document.getElementById("dollarCounter")?.getBoundingClientRect();
    if (rect == undefined)
        return COUNT_CORNER;
    const {x, y} = PointerCoordUtil.getNDC({clientX: rect.left + 0.5 * rect.height, clientY: rect.top + 0.5 * rect.height}, ndcTemp);
    return {x, y};
}
