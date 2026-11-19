import SinglePlayerModeClientConfig from "./singlePlayerModeClientConfig";

const SandboxSinglePlayerModeClientConfig: SinglePlayerModeClientConfig =
{
    loadSteps: () =>
    {
        return {
            // Sandbox: an empty, static room with a free camera (FreeCameraPose.moveTo/lookAt), where
            // local playtests build what they test (see AutomationSetupUtil's sandbox group).
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
