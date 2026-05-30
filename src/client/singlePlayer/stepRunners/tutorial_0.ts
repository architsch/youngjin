import * as THREE from "three";
import ClientObjectManager from "../../object/clientObjectManager";
import SinglePlayerStepRunner from "./singlePlayerStepRunner";
import SinglePlayerUtil from "../util/singlePlayerUtil";

export class Tutorial_0 extends SinglePlayerStepRunner
{
    firstTime: boolean = true;
    nextStepPending: boolean = false;
    initialPlayerPos: THREE.Vector3 = new THREE.Vector3();
    currPlayerPos: THREE.Vector3 = new THREE.Vector3();
    initialPlayerDir: THREE.Vector3 = new THREE.Vector3();
    currPlayerDir: THREE.Vector3 = new THREE.Vector3();

    start(): void
    {
        this.firstTime = true;
        this.nextStepPending = false;
    }

    update(deltaTime: number): void
    {
        if (this.nextStepPending)
            return;

        const myPlayer = ClientObjectManager.getMyPlayer();
        if (myPlayer)
        {
            this.currPlayerPos.copy(myPlayer.position);
            myPlayer.obj.getWorldDirection(this.currPlayerDir);

            if (this.firstTime)
            {
                this.firstTime = false;
                this.initialPlayerPos.copy(this.currPlayerPos);
                this.initialPlayerDir.copy(this.currPlayerDir);
            }
            else if (this.currPlayerPos.distanceTo(this.initialPlayerPos) > 0.5 ||
                this.currPlayerDir.angleTo(this.initialPlayerDir) > 0.125 * Math.PI) // player moved
            {
                this.nextStepPending = true;
                setTimeout(() => SinglePlayerUtil.setSinglePlayerStep(1), 500);
            }
        }
        else
        {
            this.firstTime = true;
        }
    }

    end(): void
    {
        ;
    }
}