import PictureGameObject from "./pictureGameObject";
import Vec3 from "../../../../shared/math/types/vec3";
import ObjectScaleUtil from "../../../../shared/object/util/objectScaleUtil";

// An everyday object's face: its picture alone, over the whole footprint, which its image pins to its own size
// (see PropObjectTypeConfig).
export default class PropGameObject extends PictureGameObject
{
    protected getPictureSize(): Vec3
    {
        const size = ObjectScaleUtil.getObjectSize(this.params.objectTypeIndex, this.params.transform.scale);
        return {x: size.x, y: size.y, z: 1};
    }
}
