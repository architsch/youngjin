import { useCallback, useState } from "react";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";
import Chat from "../chat/chat";
import DebugStats from "../debug/debugStats";
import VoxelQuadSelectionMenu from "../selection/voxelQuadSelectionMenu";
import PersistentObjectSelectionMenu from "../selection/persistentObjectSelectionMenu";
import Tutorial from "../tutorial/tutorial";
import UserIdentity from "../user/userIdentity";
import Loading from "./loading";
import Notification from "./notification";
import Reconnecting from "./reconnecting";
import Popup from "../basic/popup";
import { PopupType } from "../../types/PopupType";
import User from "../../../../shared/user/types/user";
import AuthPromptForm from "../form/authPromptForm";
import UserAPIClient from "../../../networking/client/userAPIClient";
import SignOutForm from "../form/signOutForm";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupType, setPopupType] = useState<PopupType>("none");

    const openAuthPromptFormPopup = useCallback(() => setPopupType("authPrompt"), []);
    const openSignOutFormPopup = useCallback(() => setPopupType("signOut"), []);
    const closePopup = useCallback(() => setPopupType("none"), []);

    return <>
        <UserIdentity
            env={env}
            user={user}
            onAuthPromptButtonClick={openAuthPromptFormPopup}
            onSignOutButtonClick={openSignOutFormPopup}
        />
        <DebugStats env={env}/>
        <div className="flex flex-col absolute bottom-0 w-full pointer-events-none">
            <PersistentObjectSelectionMenu/>
            <VoxelQuadSelectionMenu/>
            <Chat/>
        </div>
        <Tutorial user={user}/>
        {popupType == "authPrompt" && <Popup>
            <AuthPromptForm
                onPlayAsGuestButtonClick={closePopup}
                onLoginWithGoogleButtonClick={() => UserAPIClient.loginWithGoogle()}
            />
        </Popup>}
        {popupType == "signOut" && <Popup>
            <SignOutForm onCancel={closePopup}/>
        </Popup>}
        <Notification/>
        <Loading/>
        <Reconnecting/>
    </>
}

interface UIRootProps
{
    env: ThingsPoolEnv;
    user: User;
}