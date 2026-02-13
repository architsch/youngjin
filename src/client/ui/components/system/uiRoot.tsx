import { useCallback, useState } from "react";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";
import Chat from "../chat/chat";
import DebugStats from "../debug/debugStats";
import VoxelQuadSelectionMenu from "../selection/voxelQuadSelectionMenu";
import Tutorial from "../tutorial/tutorial";
import UserIdentity from "../user/userIdentity";
import Loading from "./loading";
import Reconnecting from "./reconnecting";
import Popup from "../basic/popup";
import { PopupType } from "../../types/PopupType";
import LoginWithPasswordForm from "../form/loginWithPasswordForm";
import RegisterWithPasswordForm from "../form/registerWithPasswordForm";
import User from "../../../../shared/user/types/user";
import AuthPromptForm from "../form/authPromptForm";
import UserAPIClient from "../../../networking/client/userAPIClient";
import SignOutForm from "../form/signOutForm";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupType, setPopupType] = useState<PopupType>("none");

    const openAuthPromptFormPopup = useCallback(() => setPopupType("authPrompt"), []);
    const openSignOutFormPopup = useCallback(() => setPopupType("signOut"), []);
    const openRegisterWithPasswordFormPopup = useCallback(() => setPopupType("registerWithPassword"), []);
    const openLoginWithPasswordFormPopup = useCallback(() => setPopupType("loginWithPassword"), []);
    const closePopup = useCallback(() => setPopupType("none"), []);

    return <>
        <UserIdentity
            env={env}
            user={user}
            onAuthPromptButtonClick={openAuthPromptFormPopup}
            onSignOutButtonClick={openSignOutFormPopup}
        />
        <DebugStats env={env}/>
        <Chat/>
        <VoxelQuadSelectionMenu/>
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
        {popupType == "registerWithPassword" && <Popup>
            <RegisterWithPasswordForm onCancel={closePopup}/>
        </Popup>}
        {popupType == "loginWithPassword" && <Popup>
            <LoginWithPasswordForm onCancel={closePopup}/>
        </Popup>}
        <Loading/>
        <Reconnecting/>
    </>
}

interface UIRootProps
{
    env: ThingsPoolEnv;
    user: User;
}