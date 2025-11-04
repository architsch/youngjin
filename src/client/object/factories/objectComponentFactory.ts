import GameObject from "../types/gameObject";
import GameObjectComponent from "../components/gameObjectComponent";
import { ObjectComponentConstructorMap } from "../maps/objectComponentConstructorMap";

const ObjectComponentFactory =
{
    createComponent: (parentObject: GameObject, componentName: string,
        componentConfig: {[key: string]: any}): GameObjectComponent =>
    {
        const componentConstructor = ObjectComponentConstructorMap[componentName];
        if (componentConstructor == undefined)
            throw new Error(`Component constructor not found (componentName = ${componentName})`);
        return componentConstructor(parentObject, componentConfig);
    },
}

export default ObjectComponentFactory;