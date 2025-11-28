import * as THREE from "three";
import GameObjectComponent from "./gameObjectComponent";
import GameObject from "../types/gameObject";
import ObjectManager from "../objectManager";
import { ObjectPlayerProximityCallbackMap } from "../maps/objectPlayerProximityCallbackMap";
import FirstPersonController from "./firstPersonController";

const vec3Temp = new THREE.Vector3();

export default class PlayerProximityDetector extends GameObjectComponent
{
    private maxDist: number;
    private maxLookAngle: number;
    private proximityOn: boolean;
    private proximityStartCallback: (gameObject: GameObject) => void;
    private proximityEndCallback: (gameObject: GameObject) => void;

    constructor(gameObject: GameObject, componentConfig: {[key: string]: any})
    {
        super(gameObject, componentConfig);
        this.maxDist = componentConfig.maxDist;
        this.maxLookAngle = componentConfig.maxLookAngle;
        this.proximityOn = false;

        const callbacks = ObjectPlayerProximityCallbackMap[gameObject.config.objectType];
        this.proximityStartCallback = callbacks.proximityStart;
        this.proximityEndCallback = callbacks.proximityEnd;
    }

    async onDespawn(): Promise<void>
    {
        this.turnProximityOff();
    }

    isProximityOn(): boolean
    {
        return this.proximityOn;
    }

    update(deltaTime: number)
    { 
        let proximityShouldBeOn = false;
        const player = ObjectManager.getMyPlayer();

        if (player)
        {
            const offsetX = this.gameObject.position.x - player.position.x;
            const offsetZ = this.gameObject.position.z - player.position.z;
            const distSqr = offsetX*offsetX + offsetZ*offsetZ;

            if (distSqr <= this.maxDist * this.maxDist)
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
                        const controller = player.components.firstPersonController as FirstPersonController;
                        if (controller.objectIsInLineOfSight(this.gameObject.position, this.gameObject))
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
        this.proximityStartCallback(this.gameObject);
    }

    private turnProximityOff()
    {
        if (!this.proximityOn)
            return;
        this.proximityOn = false;
        this.proximityEndCallback(this.gameObject);
    }
}