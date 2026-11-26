import * as THREE from "three";
import GraphicsManager from "../graphicsManager";
import type GameObject from "../../object/types/gameObject/gameObject";
import ObjectTypeClientConfigMap from "../../object/maps/objectTypeClientConfigMap";
import { gameModeObservable, playModeSelectionObservable, roomChangedObservable,
    updateObservable } from "../../system/clientObservables";
import Vec3 from "../../../shared/math/types/vec3";

const LISTENER_KEY = "playModeSelectionUtil";
// What counts as in view of an object whose type gives its outline no size: a block's worth about its middle.
const DEFAULT_OUTLINE_SIZE: Vec3 = {x: 0.5, y: 0.5, z: 0.5};
const NUM_BOX_CORNERS = 8;

const viewProjection = new THREE.Matrix4();
const frustum = new THREE.Frustum();
const corner = new THREE.Vector3();

// The object selected in play mode, which only a type that says so can be (see GameObject.canBeSelectedInPlayMode): its
// tools show in the chat input's place (see PlayModeSelectionMenu) and it is outlined as a selection is (see
// ObjectSelection), but the camera stays the player's own and never orbits it. So the selection ends as its outline
// leaves the camera's view, as the user clicks anything else in the room or the object again, and with the mode, the
// room or the object itself (see ClientObjectManager); and as it ends, the gaze a click on it turned goes back to rest
// (see PlayerCamera). Under the pointer input, so it imports nothing that leads to a game object.
const PlayModeSelectionUtil =
{
    select: (gameObject: GameObject): void =>
    {
        if (playModeSelectionObservable.peek() !== gameObject)
            playModeSelectionObservable.set(gameObject);
    },
    // A click on an object that can be selected: it selects it, or, already selected, lets it go.
    toggle: (gameObject: GameObject): void =>
    {
        if (playModeSelectionObservable.peek() === gameObject)
            PlayModeSelectionUtil.unselect();
        else
            PlayModeSelectionUtil.select(gameObject);
    },
    unselect: (): void =>
    {
        if (playModeSelectionObservable.peek() != null)
            playModeSelectionObservable.set(null);
    },
    // A click in the room, on an object or past everything in it: on anything but the selected object, it ends the
    // selection.
    onWorldClick: (clicked: GameObject | undefined): void =>
    {
        if (playModeSelectionObservable.peek() !== (clicked ?? null))
            PlayModeSelectionUtil.unselect();
    },
}

// Whether any of the object's outline is inside the camera's view: none is once all of its box lies beyond one side
// of that.
function isInView(gameObject: GameObject): boolean
{
    const size = ObjectTypeClientConfigMap.getConfigByIndex(gameObject.params.objectTypeIndex)
        .selection?.outlineBoxSize ?? DEFAULT_OUTLINE_SIZE;
    const camera = GraphicsManager.getCamera();
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection);
    return !frustum.planes.some(plane => {
        for (let i = 0; i < NUM_BOX_CORNERS; ++i)
        {
            corner.set(((i & 1) ? 0.5 : -0.5) * size.x, ((i & 2) ? 0.5 : -0.5) * size.y, ((i & 4) ? 0.5 : -0.5) * size.z)
                .applyQuaternion(gameObject.quaternion).add(gameObject.position);
            if (plane.distanceToPoint(corner) >= 0)
                return false;
        }
        return true;
    });
}

// Registered on import (see GameObject).
updateObservable.addListener(LISTENER_KEY, () => {
    const selected = playModeSelectionObservable.peek();
    if (selected != null && !isInView(selected))
        PlayModeSelectionUtil.unselect();
});
gameModeObservable.addListener(LISTENER_KEY, mode => {
    if (mode != "play")
        PlayModeSelectionUtil.unselect();
});
roomChangedObservable.addListener(LISTENER_KEY, () => PlayModeSelectionUtil.unselect());

export default PlayModeSelectionUtil;
