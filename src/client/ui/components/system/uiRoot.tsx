import { useCallback, useState } from "react";
import ThingsPoolEnv from "../../../system/types/thingsPoolEnv";
import Chat from "../chat/chat";
import DebugStats from "../debug/debugStats";
import VoxelQuadSelectionMenu from "../selection/voxelQuadSelectionMenu";
import Tutorial from "../tutorial/tutorial";
import UserIdentity from "../user/userIdentity";
import Loading from "./loading";
import Popup from "../basic/popup";
import { PopupType } from "../../types/PopupType";
import LoginWithPasswordForm from "../form/loginWithPasswordForm";
import RegisterWithPasswordForm from "../form/registerWithPasswordForm";
import User from "../../../../shared/user/types/user";
import { UserTypeEnumMap } from "../../../../shared/user/types/userType";
import AuthPromptForm from "../form/authPromptForm";
import UserAPIClient from "../../../networking/client/userAPIClient";

export default function UIRoot({ env, user }: UIRootProps)
{
    const userIsGuest = (user.userType == UserTypeEnumMap.Guest);
    const [popupType, setPopupType] = useState<PopupType>(userIsGuest ? "authPrompt" : "none");

    const openAuthPromptFormPopup = useCallback(() => setPopupType("authPrompt"), []);
    const openRegisterWithPasswordFormPopup = useCallback(() => setPopupType("registerWithPassword"), []);
    const openLoginWithPasswordFormPopup = useCallback(() => setPopupType("loginWithPassword"), []);
    const closePopup = useCallback(() => setPopupType("none"), []);

    return <>
        <DebugStats/>
        <UserIdentity
            env={env}
            user={user}
            onAuthPromptButtonClick={openAuthPromptFormPopup}
        />
        <Tutorial/>
        <Chat/>
        <VoxelQuadSelectionMenu/>
        {popupType == "authPrompt" && <Popup>
            <AuthPromptForm
                onPlayAsGuestButtonClick={closePopup}
                onLoginWithGoogleButtonClick={() => UserAPIClient.loginWithGoogle()}
            />
        </Popup>}
        {popupType == "registerWithPassword" && <Popup>
            <RegisterWithPasswordForm onCancel={closePopup}/>
        </Popup>}
        {popupType == "loginWithPassword" && <Popup>
            <LoginWithPasswordForm onCancel={closePopup}/>
        </Popup>}
        <Loading/>
    </>
}

interface UIRootProps
{
    env: ThingsPoolEnv;
    user: User;
}