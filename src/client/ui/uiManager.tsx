import { createRoot } from 'react-dom/client';
import DebugStats from './components/debug/debugStats';
import Tutorial from './components/tutorial/tutorial';
import Chat from './components/chat/chat';
import Loading from './components/system/loading';
import VoxelQuadSelectionMenu from './components/selection/voxelQuadSelectionMenu';

const uiRoot = createRoot(document.getElementById("uiRoot") as HTMLElement);

const UIManager =
{
    load: () =>
    {
        uiRoot.render(<>
            <DebugStats/>
            <Tutorial/>
            <Chat/>
            <VoxelQuadSelectionMenu/>
            <Loading/>
        </>);
    },
}

export default UIManager;