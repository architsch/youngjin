import Vec3 from "../../../shared/math/types/vec3";
import Collider from "./collider";
import GameObjectComponent from "./gameObjectComponent";
import { ColliderConfig } from "../../../shared/physics/types/colliderConfig";
import ClientObjectManager from "../clientObjectManager";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import { GRAVITY_SPEED } from "../../../shared/system/sharedConstants";

export default class Rigidbody extends GameObjectComponent
{
    private collider: Collider | undefined;
    private desiredVelocity: Vec3 = { x: 0, y: 0, z: 0 };

    async onSpawn(): Promise<void>
    {
        this.collider = this.gameObject.components.collider as Collider;
        if (!this.collider)
            throw new Error("Rigidbody requires Collider component");

        const colliderConfig = this.collider.componentConfig as ColliderConfig;
        if (colliderConfig.colliderType != "rigidbody")
            throw new Error("Rigidbody requires a Collider component whose type is 'rigidobdy'");
    }

    update(deltaTime: number): void
    {
        try {
            // Apply gravity to velocity
            this.desiredVelocity.y -= GRAVITY_SPEED;

            // Apply soft collisions (and step-up logic) to the velocity
            this.desiredVelocity = PhysicsManager.getAdjustedVelocity(App.getCurrentRoom()?.id!,
                this.gameObject.params.objectId, this.desiredVelocity);

            const currentPos: Vec3 = {
                x: this.gameObject.position.x,
                y: this.gameObject.position.y,
                z: this.gameObject.position.z,
            };
            
            const displacement = Vector3DUtil.scale(this.desiredVelocity, deltaTime);
            const targetPos = Vector3DUtil.add(currentPos, displacement);
            //console.log(currentPos.y.toFixed(5) + " ---> " + targetPos.y.toFixed(5));
          
            const targetDir: Vec3 = {
                x: this.gameObject.direction.x,
                y: this.gameObject.direction.y,
                z: this.gameObject.direction.z,
            };
            ClientObjectManager.setObjectTransform(this.gameObject.params.objectId,
                targetPos, targetDir, false);

            this.desiredVelocity.x = 0;
            this.desiredVelocity.y = 0;
            this.desiredVelocity.z = 0;
        } catch (err) {
            console.error(`Exception while trying to update a rigidbody :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }
    }

    setDesiredVelocity(x: number, y: number, z: number): void
    {
        this.desiredVelocity.x = x;
        this.desiredVelocity.y = y;
        this.desiredVelocity.z = z;
    }
}