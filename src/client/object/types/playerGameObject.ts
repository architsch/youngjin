import ModelGraphics from "../components/modelGraphics";
import GameObject from "./gameObject";

export default class PlayerGameObject extends GameObject
{
    onPlayerProximityStart()
    {
        if (this.isMine())
            return;
        const modelGraphics = this.components.modelGraphics as ModelGraphics;
        modelGraphics.setVisible(false);
    }

    onPlayerProximityEnd()
    {
        if (this.isMine())
            return;
        const modelGraphics = this.components.modelGraphics as ModelGraphics;
        modelGraphics.setVisible(true);
    }
}