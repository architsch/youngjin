import * as THREE from "three";
import { useEffect } from "react";
import ObjectManager from "../../../object/objectManager";
import ScreenCenterText from "../basic/screenCenterText";
import { Z_INDEX_INSTRUCTION } from "../../../../shared/system/sharedConstants";

const initialPlayerPos: THREE.Vector3 = new THREE.Vector3();
const currPlayerPos: THREE.Vector3 = new THREE.Vector3();
const initialPlayerDir: THREE.Vector3 = new THREE.Vector3();
const currPlayerDir: THREE.Vector3 = new THREE.Vector3();

export default function TutorialMoveInstruction({incrementTutorialStep}
    : {incrementTutorialStep: () => void})
{
    useEffect(() => {
        let firstTime = true;

        const interval = setInterval(() => { // start the clock
            const myPlayer = ObjectManager.getMyPlayer();
            if (myPlayer)
            {
                currPlayerPos.copy(myPlayer.position);
                myPlayer.obj.getWorldDirection(currPlayerDir);

                if (firstTime)
                {
                    firstTime = false;
                    initialPlayerPos.copy(currPlayerPos);
                    initialPlayerDir.copy(currPlayerDir);
                }
                else if (currPlayerPos.distanceTo(initialPlayerPos) > 0.5 ||
                    currPlayerDir.angleTo(initialPlayerDir) > 0.125 * Math.PI) // player moved
                {
                    clearInterval(interval);
                    setTimeout(incrementTutorialStep, 500);
                }
            }
            else
            {
                firstTime = true;
            }
        }, 100);

        return () => clearInterval(interval); // stop the clock
    }, []);

    return <ScreenCenterText text="Drag to Move" customClassNames={className}/>;
}

const className = `text-amber-300 text-4xl bg-black/50 ${Z_INDEX_INSTRUCTION}`;