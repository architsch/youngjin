import { createRoot } from 'react-dom/client';
import ThingsPoolEnv from '../system/types/thingsPoolEnv';
import UIRoot from './components/system/uiRoot';

const uiRoot = createRoot(document.getElementById("uiRoot") as HTMLElement);

const UIManager =
{
    load: (env: ThingsPoolEnv) =>
    {
        uiRoot.render(<UIRoot env={env}/>);
    },
}

export default UIManager;