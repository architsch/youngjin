import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import GraphicsManager from "../../../../graphics/graphicsManager";

const vecTemp1 = new THREE.Vector3();
const vecTemp2 = new THREE.Vector3();

// A CSS2D button standing over a point of the room (always on top), under a caption: e.g. what selects a thing
// with no surface of its own to click, under its name. Either part can be left out. It shrinks with camera
// distance, as a speech bubble does.
export default class WorldSpaceCaptionedButton
{
    private hotspot: THREE.Object3D = new THREE.Object3D();
    private wrapper: HTMLElement;
    private stack: HTMLElement;
    private caption: HTMLElement;
    private button: HTMLElement;
    private css2dObject: CSS2DObject;
    private onClickCallback: (() => void) | null = null;

    // buttonId: lets automation address the button.
    constructor(buttonText: string, buttonId?: string)
    {
        // Outer wrapper is managed by CSS2DRenderer (its transform is used for positioning).
        this.wrapper = document.createElement("div");
        this.wrapper.style.cssText = "pointer-events:none;";

        // Styling lives on inner elements so it doesn't fight CSS2DRenderer's wrapper transform.
        this.stack = document.createElement("div");
        this.stack.style.cssText =
            "display:flex; flex-direction:column; align-items:center; gap:0.25em; padding-bottom:0.4em;" +
            "user-select:none; white-space:nowrap;";

        this.caption = document.createElement("div");
        this.caption.style.cssText =
            "padding:0.1em 0.4em; color:white; background-color:rgba(0, 0, 0, 0.75); border-radius:0.4em;";

        this.button = document.createElement("div");
        if (buttonId != undefined)
            this.button.id = buttonId;
        this.button.textContent = buttonText;
        this.button.style.cssText =
            "cursor:pointer; pointer-events:auto; padding:0.15em 0.6em; font-weight:bold;" +
            "color:black; background-color:white; border-radius:0.4em;" +
            "box-shadow:0 0 4px rgba(0, 0, 0, 0.6); transition:transform 0.1s ease;";
        this.button.addEventListener("pointerenter", () => {
            this.button.style.transform = "scale(1.15)";
        });
        this.button.addEventListener("pointerleave", () => {
            this.button.style.transform = "scale(1)";
        });
        this.button.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this.onClickCallback?.();
        });

        this.stack.appendChild(this.caption);
        this.stack.appendChild(this.button);
        this.wrapper.appendChild(this.stack);
        this.css2dObject = new CSS2DObject(this.wrapper);
        // Stands on the point, rather than over it.
        this.css2dObject.center.set(0.5, 1);
        this.hotspot.add(this.css2dObject);
        this.setCaption("");
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.hotspot);
    }

    setPosition(x: number, y: number, z: number): void
    {
        this.hotspot.position.set(x, y, z);
    }

    // An empty caption shows none.
    setCaption(text: string): void
    {
        if (this.caption.textContent !== text)
            this.caption.textContent = text;
        this.caption.style.display = (text.length > 0) ? "block" : "none";
    }

    setButtonVisible(visible: boolean): void
    {
        this.button.style.display = visible ? "block" : "none";
    }

    setVisible(visible: boolean): void
    {
        this.hotspot.visible = visible;
        this.wrapper.style.display = visible ? "block" : "none";
    }

    setOnClick(callback: (() => void) | null): void
    {
        this.onClickCallback = callback;
    }

    // Keeps its size in step with its distance from the camera; call each frame while shown.
    update(): void
    {
        if (!this.hotspot.visible)
            return;
        this.hotspot.getWorldPosition(vecTemp1);
        GraphicsManager.getCamera().getWorldPosition(vecTemp2);
        const dist = vecTemp1.distanceTo(vecTemp2);
        this.stack.style.fontSize = `${Math.max(0.5, 1.1 - 0.04 * dist).toFixed(3)}rem`;
    }

    dispose(): void
    {
        this.wrapper.remove();
        this.css2dObject.removeFromParent();
        this.hotspot.removeFromParent();
    }
}
