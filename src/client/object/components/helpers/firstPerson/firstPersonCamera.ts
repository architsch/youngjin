import * as THREE from "three";
import FirstPersonController from "../../firstPersonController";
import GraphicsManager from "../../../../graphics/graphicsManager";
import { playerViewTargetPosObservable } from "../../../../system/clientObservables";
import GameObject from "../../../types/gameObject";
import Num from "../../../../../shared/math/util/num";
import { NEAR_EPSILON } from "../../../../../shared/system/constants";
import WorldSpaceSelection from "../../../../graphics/types/gizmo/worldSpaceSelection";

const frustum = new THREE.Frustum();
const mat4Temp = new THREE.Matrix4();

const cameraPos = new THREE.Vector3();
const playerRightDir = new THREE.Vector3();
const viewDir = new THREE.Vector3();
const viewDirOnVerticalPlane = new THREE.Vector3();
const playerForwardDir = new THREE.Vector3();
const right = new THREE.Vector3(1, 0, 0);
const up = new THREE.Vector3(0, 1, 0);

export default class FirstPersonCamera
{
    private player: GameObject | undefined;
    private camera: THREE.PerspectiveCamera | undefined;
    private defaultQuaternion = new THREE.Quaternion();
    private quaternionInterpTarget = new THREE.Quaternion();

    onSpawn(controller: FirstPersonController): void
    {
        this.player = controller.gameObject;

        this.camera = GraphicsManager.getCamera();
        controller.gameObject.obj.add(this.camera);
        this.camera.position.set(0, 2, 0);

        this.defaultQuaternion.copy(this.camera.quaternion);
        this.quaternionInterpTarget.copy(this.defaultQuaternion);

        const pointLight = new THREE.PointLight(0xffffff, 4.0, 16, 0.5);
        this.camera.add(pointLight);
        pointLight.position.set(0, 0, 0);
    }

    update(deltaTime: number, controller: FirstPersonController): void
    {
        this.updateTargetPitch();
        this.camera!.quaternion.slerpQuaternions(
            this.camera!.quaternion, this.quaternionInterpTarget, 4 * deltaTime);
    }

    private updateTargetPitch(): void
    {
        const angleForViewTarget = this.processViewTarget(playerViewTargetPosObservable.peek());
        const angleForAltitude = -0.4 * this.player!.position.y;
        const desiredAngle = Math.abs(angleForViewTarget) > Math.abs(angleForAltitude)
            ? angleForViewTarget : angleForAltitude;

        if (Math.abs(desiredAngle) > NEAR_EPSILON)
            this.quaternionInterpTarget.setFromAxisAngle(right, desiredAngle);
        else
            this.quaternionInterpTarget.copy(this.defaultQuaternion);
    }

    private processViewTarget(playerViewTargetPos: THREE.Vector3 | null): number
    {
        if (playerViewTargetPos == null)
            return 0;
    
        // Current selection went out of sight? Then just unselect whatever was selected.
        mat4Temp.multiplyMatrices(this.camera!.projectionMatrix, this.camera!.matrixWorldInverse);
        frustum.setFromProjectionMatrix(mat4Temp);
        if (!frustum.containsPoint(playerViewTargetPos))
        {
            WorldSpaceSelection.unselectAll();
            return 0;
        }

        this.camera!.getWorldPosition(cameraPos);
        this.player!.obj.getWorldDirection(playerRightDir);
        playerRightDir.negate();
        playerForwardDir.copy(playerRightDir);
        playerRightDir.applyAxisAngle(up, -Math.PI*0.5);

        viewDir.subVectors(playerViewTargetPos, cameraPos);
        viewDirOnVerticalPlane.copy(viewDir);
        viewDirOnVerticalPlane.projectOnPlane(playerRightDir); // viewDirOnVerticalPlane = view direction that is projected onto the plane which dissects the player's face vertically.

        const verticalAngleForViewTarget = Num.clampInRange(
            0.5 * playerForwardDir.angleTo(viewDirOnVerticalPlane) * (viewDirOnVerticalPlane.y > 0 ? 1 : -1),
            -0.6, 0.6
        );
        return verticalAngleForViewTarget;
    }
}