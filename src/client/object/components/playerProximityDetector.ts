import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import FirstPersonProximityDetection from "./helpers/firstPerson/firstPersonProximityDetection";

const vec3Temp = new THREE.Vector3();

export default class PlayerProximityDetector extends GameObjectComponent
{
    private maxDist: number;
    private maxLookAngle: number;
    private proximityOn: boolean;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);
        this.maxDist = componentConfig.maxDist;
        this.maxLookAngle = componentConfig.maxLookAngle;
        this.proximityOn = false;
    }

    async onDespawn(): Promise<void>
    {
        this.turnProximityOff();
    }

    isProximityOn(): boolean
    {
        return this.proximityOn;
    }

    updateProximity(player: GameObject, firstPersonProximityDetection: FirstPersonProximityDetection)
    { 
        let proximityShouldBeOn = false;

        const offsetX = this.gameObject.position.x - player.position.x;
        const offsetZ = this.gameObject.position.z - player.position.z;
        const distSqr = offsetX*offsetX + offsetZ*offsetZ;

        if (distSqr <= this.maxDist * this.maxDist)
        {
            if (this.maxLookAngle < 0)
            {
                proximityShouldBeOn = true;
            }
            else
            {
                player.obj.getWorldDirection(vec3Temp);
                const lookX = -vec3Temp.x;
                const lookZ = -vec3Temp.z;

                const offsetLength = Math.sqrt(distSqr);
                const lookLength = Math.sqrt(lookX*lookX + lookZ*lookZ);

                if (offsetLength <= 0.001 || lookLength <= 0.001)
                {
                    proximityShouldBeOn = true;
                }
                else
                {
                    // normalized vector coordinates
                    const offsetXn = offsetX / offsetLength;
                    const offsetZn = offsetZ / offsetLength;
                    const lookXn = lookX / lookLength;
                    const lookZn = lookZ / lookLength;

                    // angle measurement
                    const dot = offsetXn*lookXn + offsetZn*lookZn;
                    const lookAngle = Math.acos(dot);

                    if (lookAngle <= this.maxLookAngle)
                    {
                        if (firstPersonProximityDetection.objectIsInLineOfSight(this.gameObject.position, this.gameObject))
                            proximityShouldBeOn = true;
                    }
                }
            }
        }

        if (proximityShouldBeOn)
            this.turnProximityOn();
        else
            this.turnProximityOff();
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