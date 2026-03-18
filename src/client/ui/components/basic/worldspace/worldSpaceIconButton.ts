import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

// A world-space icon-button rendered as a CSS2DObject (always visible on top of all meshes).
// Displays a text label (e.g. "+" or "-") and responds to click events.
export default class WorldSpaceIconButton
{
    private hotspot: THREE.Object3D = new THREE.Object3D();
    private wrapper: HTMLElement;
    private inner: HTMLElement;
    private css2dObject: CSS2DObject;
    private onClickCallback: (() => void) | null = null;

    constructor(label: string, bgColor: string = "#333333", textColor: string = "#ffffff")
    {
        // Outer wrapper is managed by CSS2DRenderer (its transform is used for positioning).
        this.wrapper = document.createElement("div");
        this.wrapper.style.cssText = "pointer-events:none;";

        // Inner element carries the visual styling and hover scale effect,
        // so it won't conflict with CSS2DRenderer's transform on the wrapper.
        this.inner = document.createElement("div");
        this.inner.textContent = label;
        this.inner.style.cssText =
            "cursor:pointer; user-select:none; font-size:0.9rem; font-weight:bold;" +
            "color:" + textColor + "; background-color:" + bgColor + ";" +
            "width:1.4rem; height:1.4rem; line-height:1.4rem; text-align:center;" +
            "border-radius:50%; pointer-events:auto; transition:transform 0.1s ease;" +
            "box-shadow: 0 0 4px rgba(0,0,0,0.6);";

        this.inner.addEventListener("pointerenter", () => {
            this.inner.style.transform = "scale(1.3)";
        });
        this.inner.addEventListener("pointerleave", () => {
            this.inner.style.transform = "scale(1)";
        });
        this.inner.addEventListener("click", (ev) => {
            ev.stopPropagation();
            if (this.onClickCallback)
                this.onClickCallback();
        });

        this.wrapper.appendChild(this.inner);
        this.css2dObject = new CSS2DObject(this.wrapper);
        this.css2dObject.center.set(0.5, 0.5);
        this.hotspot.add(this.css2dObject);
    }

    addToParent(parent: THREE.Object3D): void
    {
        parent.add(this.hotspot);
    }

    removeFromParent(): void
    {
        this.hotspot.removeFromParent();
    }

    setPosition(x: number, y: number, z: number): void
    {
        this.hotspot.position.set(x, y, z);
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

    dispose(): void
    {
        this.wrapper.remove();
        this.css2dObject.removeFromParent();
        this.hotspot.removeFromParent();
    }
}
