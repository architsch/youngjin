import ModelGraphics from "../components/modelGraphics";
import GameObject from "./gameObject";

export default class PlayerGameObject extends GameObject
{
    // If another player gets too close close to the user, it should become temporarily invisible.
    onPlayerProximityStart()
    {
        if (this.isMine())
            return;
        const modelGraphics = this.components.modelGraphics as ModelGraphics;
        modelGraphics.setVisible(false);
    }
    
    // If another player stops being too close to the user, it should become visible again.
    onPlayerProximityEnd()
    {
        if (this.isMine())
            return;
        const modelGraphics = this.components.modelGraphics as ModelGraphics;
        modelGraphics.setVisible(true);
    }
}