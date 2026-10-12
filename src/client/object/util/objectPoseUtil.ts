import * as THREE from "three";
import Vec3 from "../../../shared/math/types/vec3";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import AddObjectSignal from "../../../shared/object/types/addObjectSignal";
import ObjectScaleUtil from "../../../shared/object/util/objectScaleUtil";
import QuarterTurnsUtil from "../../../shared/object/util/quarterTurnsUtil";

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const vec3Temp = new THREE.Vector3();
const rightTemp = new THREE.Vector3();
const upTemp = new THREE.Vector3();
const normalTemp = new THREE.Vector3();
const backTemp = new THREE.Vector3();
const basisTemp = new THREE.Matrix4();
const uprightTemp = new THREE.Quaternion();

// Where an object's stored transform puts what draws it (see GameObject), whatever that is drawn in.
const ObjectPoseUtil =
{
    // Puts a node where an object stands, facing as it faces. attached: whether its type is attached to voxel
    // faces (see ObjectTypeConfig.attachment).
    pose: (node: THREE.Object3D, attached: boolean, pos: Vec3, dir: Vec3): void =>
    {
        node.position.set(pos.x, pos.y, pos.z);
        if (attached)
        {
            // From the face's own axes. lookAt would leave a floor or ceiling facing's roll to the error
            // its stored facing decodes with (see Geometry3DUtil.getAxisFacingBasis).
            const {normal, right, up} = Geometry3DUtil.getAxisFacingBasis(dir);
            basisTemp.makeBasis(rightTemp.set(right.x, right.y, right.z), upTemp.set(up.x, up.y, up.z),
                normalTemp.set(normal.x, normal.y, normal.z));
            node.quaternion.setFromRotationMatrix(basisTemp);
            return;
        }
        vec3Temp.set(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z);
        node.lookAt(vec3Temp);
    },
    // Stands an NPC's body up in the node its object is posed as (see NpcGameObject). The body looks along its
    // own -z (see FORWARD_DIR), which is turned onto the way its content's top points across the floor (see
    // QuarterTurnsUtil.getContentUp); its middle is half its height up from there.
    poseNpcBody: (body: THREE.Object3D, node: THREE.Object3D, obj: AddObjectSignal): void =>
    {
        const transform = obj.transform;
        const facing = QuarterTurnsUtil.getContentUp(transform.dir, QuarterTurnsUtil.getQuarterTurns(obj));
        backTemp.set(-facing.x, -facing.y, -facing.z);
        rightTemp.crossVectors(WORLD_UP, backTemp);
        uprightTemp.setFromRotationMatrix(basisTemp.makeBasis(rightTemp, WORLD_UP, backTemp));

        // Relative to the object's own turn, which lays its local z along the floor's normal.
        body.quaternion.copy(node.quaternion).invert().multiply(uprightTemp);
        const height = ObjectScaleUtil.getObjectSize(obj.objectTypeIndex, transform.scale).z;
        body.position.set(0, 0, 0.5 * height);
    },
}

export default ObjectPoseUtil;
