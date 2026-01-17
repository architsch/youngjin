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
import LoginForm from "../form/loginForm";
import RegisterForm from "../form/registerForm";
import User from "../../../../shared/user/types/user";

export default function UIRoot({ env, user }: UIRootProps)
{
    const [popupType, setPopupType] = useState<PopupType>("none");

    const openRegisterFormPopup = useCallback(() => setPopupType("register"), []);
    const openLoginFormPopup = useCallback(() => setPopupType("login"), []);
    const closePopup = useCallback(() => setPopupType("none"), []);

    return <>
        <DebugStats/>
        <UserIdentity
            env={env}
            user={user}
            onRegisterButtonClick={openRegisterFormPopup}
            onLogInButtonClick={openLoginFormPopup}
        />
        <Tutorial/>
        <Chat/>
        <VoxelQuadSelectionMenu/>
        {popupType == "register" && <Popup>
            <RegisterForm onCancel={closePopup}/>
        </Popup>}
        {popupType == "login" && <Popup>
            <LoginForm onCancel={closePopup}/>
        </Popup>}
        <Loading/>
    </>
}

interface UIRootProps
{
    env: ThingsPoolEnv;
    user: User;
}