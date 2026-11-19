import * as THREE from "three";

// GraphicsManager as the particle system sees it (see server.js): the preview's own scene and camera.
const scene = new THREE.Scene();
// As the game's camera sees.
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

const GraphicsManagerStandIn =
{
    getScene: (): THREE.Scene =>
    {
        return scene;
    },
    getCamera: (): THREE.PerspectiveCamera =>
    {
        return camera;
    },
    addObjectToSceneIfNotAlreadyAdded: (object: THREE.Object3D): void =>
    {
        if (object.parent !== scene)
            scene.add(object);
    },
    // Emitters spawn every particle, as they do in the game at full resolution.
    isResolutionAtFloor: (): boolean =>
    {
        return false;
    },
}

export default GraphicsManagerStandIn;
