import { createRoot } from 'react-dom/client';
import RobotRoomsEnv from '../system/types/robotRoomsEnv';
import UIRoot from './uiRoot';
import CameraUIRoot from './cameraUIRoot';
import User from '../../shared/user/types/user';

const uiRoot = createRoot(document.getElementById("uiRoot") as HTMLElement);

const UIManager =
{
    load: (env: RobotRoomsEnv, user: User) =>
    {
        uiRoot.render((env.cameraToken.length > 0) ? <CameraUIRoot/> : <UIRoot env={env} user={user}/>);
    },
}

export default UIManager;
