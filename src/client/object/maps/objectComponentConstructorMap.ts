import PhysicsUpdater from "../components/physicsUpdater";
import FirstPersonController from "../components/firstPersonController";
import GameObjectComponent from "../components/gameObjectComponent";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import ModelGraphics from "../components/modelGraphics";
import PeriodicTransformEmitter from "../components/periodicTransformEmitter";
import PeriodicTransformReceiver from "../components/periodicTransformReceiver";
import PlayerProximityDetector from "../components/playerProximityDetector";
import SpeechBubble from "../components/speechBubble";
import GameObject from "../types/gameObject";
import Collider from "../components/collider";

export const ObjectComponentConstructorMap: {[componentType: string]:
    (parentObject: GameObject, componentConfig: {[key: string]: any}) => GameObjectComponent} =
{
    "physicsUpdater": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new PhysicsUpdater(parentObject, componentConfig),
    "collider": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new Collider(parentObject, componentConfig),
    "firstPersonController": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new FirstPersonController(parentObject, componentConfig),
    "instancedMeshGraphics": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new InstancedMeshGraphics(parentObject, componentConfig),
    "modelGraphics": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new ModelGraphics(parentObject, componentConfig),
    "periodicTransformEmitter": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new PeriodicTransformEmitter(parentObject, componentConfig),
    "periodicTransformReceiver": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new PeriodicTransformReceiver(parentObject, componentConfig),
    "speechBubble": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new SpeechBubble(parentObject, componentConfig),
    "playerProximityDetector": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new PlayerProximityDetector(parentObject, componentConfig),
}