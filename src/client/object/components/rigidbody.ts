import Vec3 from "../../../shared/math/types/vec3";
import Collider from "./collider";
import GameObjectComponent from "./gameObjectComponent";
import ClientObjectManager from "../clientObjectManager";
import ErrorUtil from "../../../shared/system/util/errorUtil";
import PhysicsManager from "../../../shared/physics/physicsManager";
import App from "../../app";
import Vector3DUtil from "../../../shared/math/util/vector3DUtil";
import { GRAVITY_SPEED, NEAR_EPSILON } from "../../../shared/system/sharedConstants";
import ObjectTransform from "../../../shared/object/types/objectTransform";

export default class Rigidbody extends GameObjectComponent
{
    private collider: Collider | undefined;
    private desiredVelocity: Vec3 = { x: 0, y: 0, z: 0 };
    private imposedDisplacement: Vec3 = { x: 0, y: 0, z: 0 };
    private underForce: boolean = false;

    async onSpawn(): Promise<void>
    {
        this.collider = this.gameObject.components.collider as Collider;
        if (!this.collider)
            throw new Error("Rigidbody requires Collider component");
    }

    update(deltaTime: number): void
    {
        this.imposedDisplacement = { x: 0, y: 0, z: 0 };
        this.underForce = false;
        try {
            const steering: Vec3 = { ...this.desiredVelocity };
            const roomID = App.getCurrentRoom()?.id!;
            const objectId = this.gameObject.params.objectId;

            // Apply gravity to velocity
            this.desiredVelocity.y -= GRAVITY_SPEED;

            // Apply soft collisions (and step-up logic) to the velocity
            this.desiredVelocity = PhysicsManager.getAdjustedVelocity(roomID, objectId, this.desiredVelocity);

            // Apply the forces of whatever blows on the object, and the velocity it carries from them
            const unforcedVelocity = this.desiredVelocity;
            this.desiredVelocity = PhysicsManager.applyForces(roomID, objectId, unforcedVelocity, deltaTime);
            this.underForce = !Vector3DUtil.equal(this.desiredVelocity, unforcedVelocity);

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
            ClientObjectManager.setObjectTransform(objectId,
                new ObjectTransform(targetPos, targetDir, this.gameObject.params.transform.scale), false);

            // Held back from where it was steered (by a wall, a slide or a crowd), the move counts as
            // steering, so whatever trails the imposed part never goes where the body couldn't.
            const pos = this.gameObject.position;
            const movedX = pos.x - currentPos.x, movedZ = pos.z - currentPos.z;
            const steeredX = steering.x * deltaTime, steeredZ = steering.z * deltaTime;
            const heldBack = movedX * movedX + movedZ * movedZ <
                (steeredX * steeredX + steeredZ * steeredZ) * (1 - NEAR_EPSILON);
            this.imposedDisplacement = {
                x: heldBack ? 0 : movedX - steeredX,
                y: pos.y - currentPos.y - steering.y * deltaTime,
                z: heldBack ? 0 : movedZ - steeredZ,
            };

            this.desiredVelocity.x = 0;
            this.desiredVelocity.y = 0;
            this.desiredVelocity.z = 0;
        } catch (err) {
            console.error(`Exception while trying to update a rigidbody :: Error: ${ErrorUtil.getErrorMessage(err)}`);
        }
    }

    // The part of the last move that physics made rather than the steering: a step climbed, a drop,
    // a push. Zero on a frame the object didn't move under physics.
    getImposedDisplacement(): Vec3
    {
        return this.imposedDisplacement;
    }

    // Whether a force of the room's had a part in the last move: one acting on the object, or one whose
    // velocity the object still carried (see PhysicsForceUtil).
    isUnderForce(): boolean
    {
        return this.underForce;
    }

    getDesiredVelocity(): Vec3
    {
        return this.desiredVelocity;
    }

    setDesiredVelocity(x: number, y: number, z: number): void
    {
        this.desiredVelocity.x = x;
        this.desiredVelocity.y = y;
        this.desiredVelocity.z = z;
    }
}