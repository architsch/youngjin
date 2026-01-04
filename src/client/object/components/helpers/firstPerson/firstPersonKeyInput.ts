import { numActiveTextInputsObservable } from "../../../../system/observables";
import FirstPersonController from "../../firstPersonController";

export default class FirstPersonKeyInput
{
    private upKeyPressed: boolean = false;
    private downKeyPressed: boolean = false;
    private leftKeyPressed: boolean = false;
    private rightKeyPressed: boolean = false;
    private keyVelocityX: number = 0;
    private keyVelocityY: number = 0;

    onSpawn(controller: FirstPersonController): void
    {
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.processKey = this.processKey.bind(this);
        this.onNumActiveTextInputsUpdated = this.onNumActiveTextInputsUpdated.bind(this);
        
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        numActiveTextInputsObservable.addListener(`${controller.gameObject.params.objectId}.FirstPersonController`, this.onNumActiveTextInputsUpdated);
    }

    onDespawn(controller: FirstPersonController): void
    {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        numActiveTextInputsObservable.removeListener(`${controller.gameObject.params.objectId}.FirstPersonController`);
    }

    update(deltaTime: number, controller: FirstPersonController): void
    {
        const keyInputX = (this.leftKeyPressed ? -0.4 : 0) + (this.rightKeyPressed ? 0.4 : 0);
        const keyInputY = (this.upKeyPressed ? 0.5 : 0) + (this.downKeyPressed ? -0.5 : 0);
        const diffX = keyInputX - this.keyVelocityX;
        const diffY = keyInputY - this.keyVelocityY;
        const accelX = 3 * deltaTime;
        const accelY = 2.5 * deltaTime;
        this.keyVelocityX = (Math.abs(diffX) > accelX)
            ? (this.keyVelocityX + accelX * (diffX > 0 ? 1 : -1))
            : keyInputX;
        this.keyVelocityY = (Math.abs(diffY) > accelY)
            ? (this.keyVelocityY + accelY * (diffY > 0 ? 1 : -1))
            : keyInputY;

        controller.dx += this.keyVelocityX;
        controller.dy += this.keyVelocityY;
    }

    private onKeyDown(ev: KeyboardEvent)
    {
        this.processKey(ev, true);
    }

    private onKeyUp(ev: KeyboardEvent)
    {
        this.processKey(ev, false);
    }

    private processKey(ev: KeyboardEvent, keyDown: boolean)
    {
        if (numActiveTextInputsObservable.peek() > 0)
        {
            return; // User is typing something in a text input, so don't process an alphabet key as a control key.
        }
        switch (ev.code)
        {
            case "ArrowUp": case "KeyW":
                ev.preventDefault();
                this.upKeyPressed = keyDown;
                break;
            case "ArrowDown": case "KeyS":
                ev.preventDefault();
                this.downKeyPressed = keyDown;
                break;
            case "ArrowLeft": case "KeyA":
                ev.preventDefault();
                this.leftKeyPressed = keyDown;
                break;
            case "ArrowRight": case "KeyD":
                ev.preventDefault();
                this.rightKeyPressed = keyDown;
                break;
        }
    }

    private onNumActiveTextInputsUpdated()
    {
        this.upKeyPressed = false;
        this.downKeyPressed = false;
        this.leftKeyPressed = false;
        this.rightKeyPressed = false;
        this.keyVelocityX = 0;
        this.keyVelocityY = 0;
    }
}