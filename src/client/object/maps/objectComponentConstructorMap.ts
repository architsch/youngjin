import Rigidbody from "../components/rigidbody";
import PlayerController from "../components/playerController";
import GameObjectComponent from "../components/gameObjectComponent";
import MeshGraphics from "../components/meshGraphics";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import ModelGraphics from "../components/modelGraphics";
import PeriodicTransformEmitter from "../components/periodicTransformEmitter";
import PeriodicTransformReceiver from "../components/periodicTransformReceiver";
import PlayerProximityDetector from "../components/playerProximityDetector";
import SpeechBubble from "../components/speechBubble";
import GameObject from "../types/gameObject";
import Collider from "../components/collider";
import EasingMotion from "../components/easingMotion";
import InstancedMeshComposer from "../components/instancedMeshComposer";

export const ObjectComponentConstructorMap: {[componentType: string]:
    (parentObject: GameObject, componentConfig: {[key: string]: any}) => GameObjectComponent} =
{
    "rigidbody": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new Rigidbody(parentObject, componentConfig),
    "collider": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new Collider(parentObject, componentConfig),
    "playerController": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new PlayerController(parentObject, componentConfig),
    "meshGraphics": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new MeshGraphics(parentObject, componentConfig),
    "instancedMeshGraphics": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new InstancedMeshGraphics(parentObject, componentConfig),
    "instancedMeshComposer": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new InstancedMeshComposer(parentObject, componentConfig),
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
    "easingMotion": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new EasingMotion(parentObject, componentConfig),
}