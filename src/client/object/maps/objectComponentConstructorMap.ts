import DynamicCollider from "../components/dynamicCollider";
import FirstPersonController from "../components/firstPersonController";
import GameObjectComponent from "../components/gameObjectComponent";
import InstancedMeshGraphics from "../components/instancedMeshGraphics";
import ModelGraphics from "../components/modelGraphics";
import ObjectSyncEmitter from "../components/objectSyncEmitter";
import ObjectSyncReceiver from "../components/objectSyncReceiver";
import PersistentObjectMeshInstancer from "../components/persistentObjectMeshInstancer";
import PlayerProximityDetector from "../components/playerProximityDetector";
import SpeechBubble from "../components/speechBubble";
import StaticCollider from "../components/staticCollider";
import VoxelMeshInstancer from "../components/voxelMeshInstancer";
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
    "objectSyncEmitter": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new ObjectSyncEmitter(parentObject, componentConfig),
    "objectSyncReceiver": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new ObjectSyncReceiver(parentObject, componentConfig),
    "speechBubble": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new SpeechBubble(parentObject, componentConfig),
    "voxelMeshInstancer": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new VoxelMeshInstancer(parentObject, componentConfig),
    "persistentObjectMeshInstancer": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new PersistentObjectMeshInstancer(parentObject, componentConfig),
    "playerProximityDetector": (parentObject: GameObject, componentConfig: {[key: string]: any}): GameObjectComponent =>
        new PlayerProximityDetector(parentObject, componentConfig),
}