import SinglePlayerModeClientConfig from "./singlePlayerModeClientConfig";

const SandboxSinglePlayerModeClientConfig: SinglePlayerModeClientConfig =
{
    loadSteps: () =>
    {
        return {
            // In sandbox mode, the camera is in "free mode" so that the client can
            // simply invoke `FreeCameraPose.moveTo(...)` and `FreeCameraPose.lookAt(...)`
            // methods to directly control the camera's position/direction.
            // Also, the room is empty and no gameplay logic is active
            // (except each GameObject's own behavior). The client is free to
            // use this blank and static scenery as a "movie set" by adding any
            // voxel-blocks & objects at any desired locations (for the purpose of
            // setting up a scene for screenshots, etc).
            // To do this, use the methods in the places listed below:
            //      - `ClientVoxelManager` (for voxel addition/removal/modification + voxel texture pack change)
            //      - `ClientObjectManager` (for object addition/removal/modification)
            "initial": {
                startDelay: 0,
                actionsOnStart: [
                    {type: "set_camera_mode", mode: {type: "free"}},
                ],
                transitionRules: [],
                actionsOnEnd: [
                    {type: "set_camera_mode", mode: {type: "firstPerson"}}
                ],
            },
        };
    },
    onModeEnd: () =>
    {
        return [];
    },
};

export default SandboxSinglePlayerModeClientConfig;
