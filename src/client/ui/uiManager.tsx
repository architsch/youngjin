import { createRoot } from 'react-dom/client';
import DebugStats from './components/debug/debugStats';
import Tutorial from './components/tutorial/tutorial';
import Chat from './components/chat/chat';
import Loading from './components/core/loading';

const uiRoot = createRoot(document.getElementById("uiRoot") as HTMLElement);

const UIManager =
{
    load: () =>
    {
        uiRoot.render(<>
            <DebugStats/>
            <Tutorial/>
            <Chat/>
            <Loading/>
        </>);
    },
}

export default UIManager;