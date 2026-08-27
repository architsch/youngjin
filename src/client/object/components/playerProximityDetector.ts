import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import MeshGraphics from "./meshGraphics";
import CameraUtil from "../../graphics/util/cameraUtil";
import NumUtil from "../../../shared/math/util/numUtil";
import { cameraModeObservable } from "../../system/clientObservables";

const vec3Temp = new THREE.Vector3();
const probePointTemp = new THREE.Vector3();

// The shortest vector still worth taking a direction from. Anything shorter is a direction the
// scene does not really hold — a player standing on top of the object, or an object with no facing
// to speak of — and an angle measured off one would be noise.
const minMeasurableLength = 0.001;

export default class PlayerProximityDetector extends GameObjectComponent
{
    private maxDist: number;
    private maxLookAngle: number; // (maxLookAngle <= 0) if the look-angle doesn't matter
    private maxFaceAngle: number; // (maxFaceAngle <= 0) if the side the object is approached from doesn't matter
    private checkLineOfSight: boolean;
    private proximityOn: boolean;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);
        this.maxDist = componentConfig.maxDist;
        this.maxLookAngle = componentConfig.maxLookAngle;
        this.maxFaceAngle = componentConfig.maxFaceAngle;
        this.checkLineOfSight = componentConfig.checkLineOfSight;
        this.proximityOn = false;
    }

    async onSpawn(): Promise<void>
    {
        if (!this.gameObject.components.collider)
            throw new Error("PlayerProximityDetector requires Collider component.");

        if (this.checkLineOfSight)
        {
            const meshGraphics = this.gameObject.components.meshGraphics as MeshGraphics;
            const instancedMeshGraphics = this.gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
            if (!meshGraphics && !instancedMeshGraphics)
                throw new Error("PlayerProximityDetector with 'checkLineOfSight' requires either MeshGraphics or InstancedMeshGraphics component");
        }
    }

    async onDespawn(): Promise<void>
    {
        this.turnProximityOff();
    }

    isProximityOn(): boolean
    {
        return this.proximityOn;
    }

    updateProximity(player: GameObject)
    {
        let proximityShouldBeOn = false;

        // Trigger proximity detection only during first-person view.
        if (cameraModeObservable.peek().type === "firstPerson")
        {
            const offsetX = this.gameObject.position.x - player.position.x;
            const offsetZ = this.gameObject.position.z - player.position.z;
            const distSqr = offsetX*offsetX + offsetZ*offsetZ;

            // Each of the three questions below answers "yes" for a detector that does not ask it,
            // and they are asked cheapest first: the two angles are a handful of multiplications,
            // whereas sight is a walk of the room and a cast through everything drawn in it.
            proximityShouldBeOn = (distSqr <= this.maxDist * this.maxDist)
                && this.playerLooksAtObject(player, offsetX, offsetZ)
                && this.objectFacesPlayer(offsetX, offsetZ)
                && this.objectIsInSight();
        }

        if (proximityShouldBeOn)
            this.turnProximityOn();
        else
            this.turnProximityOff();
    }

    // Whether the player is looking the object's way. A player faces along his object's -Z (see
    // FORWARD_DIR), which is the opposite of the direction his transform is authored to point.
    private playerLooksAtObject(player: GameObject, offsetX: number, offsetZ: number): boolean
    {
        if (this.maxLookAngle <= 0)
            return true;

        player.obj.getWorldDirection(vec3Temp);
        return directionsAreWithin(this.maxLookAngle, offsetX, offsetZ, -vec3Temp.x, -vec3Temp.z);
    }

    // Whether the object is showing the player the side it faces, which is a separate question from
    // whether the player is looking at it: an entrance door has a player standing behind it looking
    // straight through it every time one arrives in the room, since he spawns in the doorway it
    // fills and walks out of it into the room. Prompting him there would flash the prompt over the
    // back of a door he is walking away from.
    //
    // The side an object faces is the way its own surface points: a flat mesh is drawn facing its
    // object's +Z (see the "Square" geometry), which is the direction a wall-mounted one is authored
    // to point out of the wall it is hung on. Note this is the opposite of the -Z a *player* faces
    // along — a player is drawn all the way round, and has a front only in the sense that he walks
    // one way rather than the other.
    private objectFacesPlayer(offsetX: number, offsetZ: number): boolean
    {
        if (this.maxFaceAngle <= 0)
            return true;

        this.gameObject.obj.getWorldDirection(vec3Temp);
        // The offset runs from the player to the object, so the way back to him is its opposite.
        return directionsAreWithin(this.maxFaceAngle, -offsetX, -offsetZ, vec3Temp.x, vec3Temp.z);
    }

    // Whether the object stands where the camera can actually see it, rather than behind whatever
    // else the room has put in the way.
    //
    // What is looked for is a point on the object itself. An object drawn from a mesh hung off its
    // origin is asked for that mesh's centre, since such an origin need not sit anywhere on the
    // object — one left down on the floor would give a probe point that grazes the floor from every
    // angle. Everything else is asked for its own position, which for an object whose collider is
    // centred on it (a door, say) is already the middle of the thing.
    private objectIsInSight(): boolean
    {
        if (!this.checkLineOfSight)
            return true;

        const mesh = (this.gameObject.components.meshGraphics as MeshGraphics)?.mesh;
        const probePoint = (mesh != undefined)
            ? mesh.getWorldPosition(probePointTemp) : this.gameObject.position;
        return CameraUtil.objectIsInLineOfSight(probePoint, this.gameObject);
    }

    private turnProximityOn()
    {
        if (this.proximityOn)
            return;
        this.proximityOn = true;
        this.gameObject.onPlayerProximityStart();
    }

    private turnProximityOff()
    {
        if (!this.proximityOn)
            return;
        this.proximityOn = false;
        this.gameObject.onPlayerProximityEnd();
    }
}

// Whether two directions lie within a given angle of each other, measured on the horizontal plane
// so that looking up or down at something is still looking at it. Either may be given unnormalized.
function directionsAreWithin(maxAngle: number, aX: number, aZ: number,
    bX: number, bZ: number): boolean
{
    const aLength = Math.sqrt(aX*aX + aZ*aZ);
    const bLength = Math.sqrt(bX*bX + bZ*bZ);
    if (aLength <= minMeasurableLength || bLength <= minMeasurableLength)
        return true; // No angle to measure, so nothing here rules anything out.

    const cosAngle = (aX*bX + aZ*bZ) / (aLength * bLength);
    return Math.acos(NumUtil.clampInRange(cosAngle, -1, 1)) <= maxAngle;
}
