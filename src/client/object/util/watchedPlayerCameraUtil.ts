import Vec3 from "../../../shared/math/types/vec3";
import App from "../../app";
import GraphicsManager from "../../graphics/graphicsManager";
import { ongoingClientProcessExists } from "../../system/types/clientProcess";
import ClientObjectManager from "../clientObjectManager";
import GameObject from "../types/gameObject/gameObject";
import PlayerCamera from "../components/helpers/player/playerCamera";
import PlayerProximityDetectionUpdater from "../components/helpers/player/playerProximityDetectionUpdater";

// On an agent's camera page (see AgentCameraUtil), the view from the watched player's eyes: the camera its own browser
// would have in play mode, following the moves the server sends of it. Nothing here steers the player.

const NO_DISPLACEMENT: Vec3 = {x: 0, y: 0, z: 0};
// Each frame is a picture: the view is where the eyes are now, without the easing a person's has, which a slow browser
// stretches to seconds. (A step this long eases all the way.)
const SETTLED_AT_ONCE = 1;

let watchedPlayer: GameObject | undefined;
let playerCamera: PlayerCamera | undefined;
const proximityUpdater = new PlayerProximityDetectionUpdater();

const WatchedPlayerCameraUtil =
{
    update: (deltaTime: number): void =>
    {
        const watchedUserID = App.getWatchedUserID();
        if (watchedUserID.length == 0)
            return;

        // Arriving anywhere, the same room again included, spawns another player, which the camera moves to.
        const player = ClientObjectManager.getPlayerOfUser(watchedUserID);
        if (player !== watchedPlayer)
        {
            playerCamera?.onDespawn();
            playerCamera = undefined;
            watchedPlayer = player;
        }
        if (player == undefined || !player.spawnFinished || ongoingClientProcessExists())
            return;
        if (playerCamera == undefined)
        {
            playerCamera = new PlayerCamera();
            playerCamera.onSpawn(player);
            GraphicsManager.holdFullResolution();
        }

        // Others too near the eyes are hidden from them, as from a person's (see PlayerGameObject).
        proximityUpdater.update(deltaTime, player);
        playerCamera.update(SETTLED_AT_ONCE, player, NO_DISPLACEMENT, false);
    },
}

export default WatchedPlayerCameraUtil;
