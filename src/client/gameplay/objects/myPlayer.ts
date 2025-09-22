import GraphicsContext from "../../graphics/graphicsContext";
import GameObject from "./gameObject";
import Updatable from "../interfaces/updatable";

export default class MyPlayer extends GameObject implements Updatable
{
    private pointerIsDown: boolean = false;
    private pointerDownPos: [number, number] = [0, 0];
    private pointerDragPos: [number, number] = [0, 0];

    constructor(graphicsContext: GraphicsContext, x: number, z: number)
    {
        super(graphicsContext, x, z);

        this.obj.add(graphicsContext.camera);
        graphicsContext.camera.position.set(0, 2, 0);

        this.obj.rotateY(Math.PI * 0.35);

        const domElement = graphicsContext.renderer.domElement;
        this.onPointerPress = this.onPointerPress.bind(this);
        this.onPointerRelease = this.onPointerRelease.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        domElement.addEventListener("pointerdown", this.onPointerPress);
        domElement.addEventListener("pointerup", this.onPointerRelease);
        domElement.addEventListener("pointercancel", this.onPointerRelease);
        domElement.addEventListener("pointerleave", this.onPointerRelease);
        domElement.addEventListener("pointerout", this.onPointerRelease);
        domElement.addEventListener("pointermove", this.onPointerMove);
    }

    update(deltaTime: number): void
    {
        if (this.pointerIsDown)
        {
            const canvas = this.graphicsContext.renderer.domElement;
            const xOffset = this.pointerDragPos[0] - this.pointerDownPos[0];
            const yOffset = this.pointerDragPos[1] - this.pointerDownPos[1];
            //console.log(`xOffset = (${xOffset}), yOffset = (${yOffset}), canvas.width = (${canvas.width}), canvas.height = (${canvas.height})`);
            this.obj.translateZ(10 * deltaTime * yOffset / canvas.height);
            this.obj.rotateY(-5 * deltaTime * xOffset / canvas.width);
        }
    }

    private onPointerPress(ev: PointerEvent): void
    {
        this.pointerIsDown = true;
        this.pointerDownPos[0] = ev.clientX;
        this.pointerDownPos[1] = ev.clientY;
        this.pointerDragPos[0] = ev.clientX;
        this.pointerDragPos[1] = ev.clientY;
    }

    private onPointerRelease(ev: PointerEvent): void
    {
        this.pointerIsDown = false;
    }

    private onPointerMove(ev: PointerEvent): void
    {
        if (this.pointerIsDown)
        {
            this.pointerDragPos[0] = ev.clientX;
            this.pointerDragPos[1] = ev.clientY;
        }
    }
}