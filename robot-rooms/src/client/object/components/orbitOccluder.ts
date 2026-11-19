import GameObjectComponent from "./gameObjectComponent";

// Marker component: the object is room fabric the orbit camera may hide while it blocks the view
// (see OrbitOcclusionHider). Characters don't carry it; hiding a person reads as them leaving.
export default class OrbitOccluder extends GameObjectComponent
{
}
