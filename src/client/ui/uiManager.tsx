import { createRoot } from 'react-dom/client';
import RoomRuntimeMemory from "../../shared/room/types/roomRuntimeMemory";
import DebugStats from './components/debug/debugStats';
import Tutorial from './components/tutorial/tutorial';
import Chat from './components/chat/chat';

const uiRoot = createRoot(document.getElementById("uiRoot") as HTMLElement);

const UIManager =
{
    load: (roomRuntimeMemory: RoomRuntimeMemory) =>
    {
        uiRoot.render(<>
            <DebugStats/>
            <Tutorial/>
            <Chat/>
        </>);
    },
    unload: () =>
    {
    },
}

export default UIManager;