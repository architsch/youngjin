import DynamicCollider from "../components/dynamicCollider";
import FirstPersonController from "../components/firstPersonController";
import GameObjectComponent from "../components/gameObjectComponent";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import ModelGraphics from "../components/modelGraphics";
import ObjectTransformEmitter from "../components/objectTransformEmitter";
import ObjectTransformReceiver from "../components/objectTransformReceiver";
import PlayerProximityDetector from "../components/playerProximityDetector";
import SpeechBubble from "../components/speechBubble";
import StaticCollider from "../components/staticCollider";
import GameObject from "../types/gameObject";

export const ObjectComponentConstructorMap: {[componentType: string]:
    (parentObject: GameObject, componentConfig: {[key: string]: any}) => GameObjectComponent} =
{
    "dynamicCollider": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new DynamicCollider(parentObject, componentConfig),
    "staticCollider": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new StaticCollider(parentObject, componentConfig),
    "firstPersonController": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new FirstPersonController(parentObject, componentConfig),
    "instancedMeshGraphics": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new InstancedMeshGraphics(parentObject, componentConfig),
    "modelGraphics": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new ModelGraphics(parentObject, componentConfig),
    "objectTransformEmitter": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new ObjectTransformEmitter(parentObject, componentConfig),
    "objectTransformReceiver": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new ObjectTransformReceiver(parentObject, componentConfig),
    "speechBubble": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new SpeechBubble(parentObject, componentConfig),
    "playerProximityDetector": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new PlayerProximityDetector(parentObject, componentConfig),
}