import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import InstancedMeshGraphics from "./instancedMeshGraphics";
import CameraUtil from "../../graphics/util/cameraUtil";
import NumUtil from "../../../shared/math/util/numUtil";
import { cameraModeObservable } from "../../system/clientObservables";

const vec3Temp = new THREE.Vector3();

// Below this length a direction is noise (e.g. standing on the object).
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
            const instancedMeshGraphics = this.gameObject.components.instancedMeshGraphics as InstancedMeshGraphics;
            if (!instancedMeshGraphics)
                throw new Error("PlayerProximityDetector with 'checkLineOfSight' requires InstancedMeshGraphics component");
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

            // Checks that aren't configured pass. Cheapest first; sight requires a grid walk and a raycast.
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

    // Players face their object's -Z (see FORWARD_DIR).
    private playerLooksAtObject(player: GameObject, offsetX: number, offsetZ: number): boolean
    {
        if (this.maxLookAngle <= 0)
            return true;

        player.obj.getWorldDirection(vec3Temp);
        return directionsAreWithin(this.maxLookAngle, offsetX, offsetZ, -vec3Temp.x, -vec3Temp.z);
    }

    // Whether the object's front faces the player (separate from the player looking at it): an
    // arriving player stands behind the entrance door looking through it, and must not be prompted.
    // Flat objects face their +Z, the opposite of a player's -Z.
    private objectFacesPlayer(offsetX: number, offsetZ: number): boolean
    {
        if (this.maxFaceAngle <= 0)
            return true;

        this.gameObject.obj.getWorldDirection(vec3Temp);
        // The offset runs from the player to the object, so the way back to him is its opposite.
        return directionsAreWithin(this.maxFaceAngle, -offsetX, -offsetZ, vec3Temp.x, vec3Temp.z);
    }

    // Line-of-sight check from the camera to the object's position (its collider centre).
    private objectIsInSight(): boolean
    {
        if (!this.checkLineOfSight)
            return true;

        return CameraUtil.objectIsInLineOfSight(this.gameObject.position, this.gameObject);
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

// Horizontal-plane angle test (looking up or down still counts). Inputs needn't be normalized.
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
