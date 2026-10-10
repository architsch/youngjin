import SinglePlayerModeClientConfig from "./singlePlayerModeClientConfig";

// Nothing is scripted: the room is the admin's to edit until they leave it (see RoomEditorUtil).
const RoomEditorSinglePlayerModeClientConfig: SinglePlayerModeClientConfig =
{
    loadSteps: () =>
    {
        return {
            "initial": {
                startDelay: 0,
                actionsOnStart: [],
                transitionRules: [],
                actionsOnEnd: [],
            },
        };
    },
    onModeEnd: () =>
    {
        return [];
    },
};

export default RoomEditorSinglePlayerModeClientConfig;
