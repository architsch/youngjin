import * as THREE from "three";
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import GraphicsManager from "../../graphics/graphicsManager";
import GameObjectComponent from "./gameObjectComponent";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../shared/object/types/objectMetadataKey";
import { SpeakerActivity, SpeakerActivityEnumMap } from "../../../shared/object/types/speakerActivity";
import SetObjectMetadataSignal from "../../../shared/object/types/setObjectMetadataSignal";
import SocketsClient from "../../networking/client/socketsClient";
import App from "../../app";
import CameraUtil from "../../graphics/util/cameraUtil";
import Geometry3DUtil from "../../../shared/math/util/geometry3DUtil";
import { cameraModeObservable, updateObservable } from "../../system/clientObservables";
import { RoomTypeEnumMap } from "../../../shared/room/types/roomType";
import MessageSegment from "../../../shared/object/types/messageSegment";
import MessageLinkUtil from "../../../shared/object/util/messageLinkUtil";
import SpeakerActivityUtil from "../../../shared/object/util/speakerActivityUtil";
import OverlayClickTargetUtil from "../../graphics/util/overlayClickTargetUtil";
import MessageLinkOpenUtil from "../../ui/util/messageLinkOpenUtil";
import ScreenControlPictureUtil from "../../ui/util/screenControlPictureUtil";

// Room left between a bubble and the edges of the view (see keepInView).
const VIEW_MARGIN_PX = 8;
// How long a helper is shown thinking on the browser's word alone, before the server's takes over (see
// HelperThinkingUtil); one the server never confirms was a wrong guess.
const EXPECTED_THINKING_MS = 3000;
const PADDING_X_REM = 0.4;
// A bubble runs as wide as its speaker's type has it, unless its message could take more lines than this there: then it
// is widened until it can't, at most this many times as wide, and never past the view's sides, so that it rises less
// far over its speaker.
const MAX_LINES_AT_TYPE_WIDTH = 3;
const MAX_WIDENING = 2;
const DEFAULT_WIDTH_IN_CHARS = 18;
// What a link's button adds to its label, in characters: its margins, padding and icon.
const LINK_BUTTON_EXTRA_CHARS = 4;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
// What a speaker shows in place of its words (see SpeakerActivityUtil.replacesWords): editing in the mode switch's green
// for Edit (Tailwind's green-300), reading (away from the game) as offline in a medium gray (its gray-400), and how long
// their dots take to come.
const ACTIVITY_LINES: {[activity: SpeakerActivity]: {word: string, color: string}} = {
    [SpeakerActivityEnumMap.Editing]: {word: "Editing", color: "oklch(87.1% 0.15 154.449)"},
    [SpeakerActivityEnumMap.Reading]: {word: "Offline", color: "oklch(70.7% 0.022 261.325)"},
};
const ACTIVITY_DOTS_CYCLE_MS = 1200;
// The dots by a typist's name: how long each takes to swell and shrink, and how far behind the one before it.
const TYPING_DOT_CYCLE_MS = 1000;
const TYPING_DOT_LAG_MS = 160;
// Characters about twice as wide as a Latin letter in the bubble's monospace font: Hangul, kana, CJK ideographs, and
// full-width forms.
const WIDE_CHARACTER = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

const anchorTemp = new THREE.Vector3();
const viewSizeTemp = new THREE.Vector2();
let instanceCount = 0;

export default class SpeechBubble extends GameObjectComponent
{
    private speechBubbleHotspot: THREE.Object3D = new THREE.Object3D();
    private textElement: HTMLElement | undefined; // CSS2D root; its transform is owned by the renderer for on-screen positioning.
    private bubbleElement: HTMLElement | undefined; // Child holding the visual box + text; safe to animate without fighting the renderer.
    private textCSS2DObject: CSS2DObject | undefined;

    private vecTemp1 = new THREE.Vector3();
    private vecTemp2 = new THREE.Vector3();

    // Set when the speaker's body isn't drawn (see PlayerGameObject), so the bubble doesn't float alone.
    private hidden: boolean = false;
    // What it was last given to say, which a redrawn bubble shows again (see refresh). The user's own words are never
    // written back to their player in a multiplayer room.
    private message: string = "";
    // Until when a helper is shown thinking before the server says so (see expectThinking).
    private thinkingExpectedUntil: number = 0;

    // How far the bubble is lowered to keep its top in view, and moved sideways to keep its sides in view.
    private lowered: number = 0;
    private shifted: number = 0;
    private readonly viewListenerKey = `speechBubble${++instanceCount}`;
    private keepingInView: boolean = false;

    async onSpawn(): Promise<void>
    {
        this.gameObject.bodyObj.add(this.speechBubbleHotspot);
        this.speechBubbleHotspot.position.set(0, this.componentConfig.yOffset as number, 0);

        const metadata = this.gameObject.params.metadata[ObjectMetadataKeyEnumMap.SentMessage];
        const initialMessage = metadata ? metadata.str : "";
        this.displayMessage(initialMessage, false); // No bounce for the message already present at spawn.

        // After the overlay has placed the bubble for the frame (see GraphicsManager.update).
        updateObservable.addListener(this.viewListenerKey, () => this.keepInView());
        this.keepingInView = true;
    }

    async onDespawn(): Promise<void>
    {
        if (this.keepingInView)
        {
            updateObservable.removeListener(this.viewListenerKey);
            this.keepingInView = false;
        }
        this.hideSpeechBubble();
    }

    update(deltaTime: number)
    {
        if (this.thinkingExpectedUntil > 0 && performance.now() >= this.thinkingExpectedUntil)
        {
            this.thinkingExpectedUntil = 0;
            this.refresh();
        }

        // If the speech bubble is active (visible), update its position and size.
        if (this.textElement)
        {
            if (this.hidden)
            {
                this.textElement.hidden = true;
                return;
            }

            this.speechBubbleHotspot.getWorldPosition(this.vecTemp1);
            GraphicsManager.getCamera().getWorldPosition(this.vecTemp2);
            const dist = this.vecTemp1.distanceTo(this.vecTemp2);

            // Near, in the field of view (hides one's own bubble in first person), and optionally unoccluded.
            if (dist < 12 && CameraUtil.pointIsInFieldOfView(this.vecTemp1) &&
                (!this.componentConfig.checkLineOfSight || this.orbitCameraIsFramingSpeaker() ||
                CameraUtil.objectIsInLineOfSight(this.vecTemp1, this.gameObject)))
            {
                const scaleFactor = Math.max(0.1, 1.5 - 0.12 * dist);
                const scaleFactorStr = `${scaleFactor.toFixed(3)}rem`;
                this.textElement.style.fontSize = scaleFactorStr;
                this.textElement.hidden = false;
            }
            else
            {
                this.textElement.hidden = true;
            }
        }
    }

    setHidden(hidden: boolean)
    {
        this.hidden = hidden;
    }

    setMessage(message: string, broadcastToServer: boolean)
    {
        this.displayMessage(message, true);

        if (broadcastToServer)
        {
            const room = App.getCurrentRoom();
            if (!room)
            {
                console.error("SpeechBubble.setMessage :: Current room not found");
                return;
            }
            if (room.roomType != RoomTypeEnumMap.SinglePlayer)
            {
                const params = new SetObjectMetadataSignal(
                    room.id, this.gameObject.params.objectId,
                    ObjectMetadataKeyEnumMap.SentMessage, message);
                SocketsClient.emitSetObjectMetadataSignal(params);
            }
        }
    }

    onSetMetadata(key: ObjectMetadataKey, value: string): void
    {
        if (key === ObjectMetadataKeyEnumMap.SentMessage)
            this.displayMessage(value, true);
        else if (key === ObjectMetadataKeyEnumMap.Activity)
        {
            this.thinkingExpectedUntil = 0;
            this.refresh();
        }
    }

    // A helper shown thinking at once, for the user's line it is about to hear, until the server's word comes.
    expectThinking(): void
    {
        this.thinkingExpectedUntil = performance.now() + EXPECTED_THINKING_MS;
        this.refresh();
    }

    // Shows the message again, for a speaker whose name has changed (see GameObject.getSpeakerName), or who has turned to
    // something else (see SpeakerActivity).
    refresh(): void
    {
        this.displayMessage(this.message, false);
    }

    // A long message from a speaker close by would rise past the top of the view: it is lowered over the speaker instead,
    // so that it reads from its first line, and bounces from its top. One from a speaker near a side of the view, which
    // would run past it, is moved in from that side (from the left, where it is wider than the view).
    private keepInView(): void
    {
        if (!this.textElement || !this.bubbleElement || this.textElement.hidden)
            return;
        const width = this.textElement.offsetWidth;
        const height = this.textElement.offsetHeight;
        if (height == 0) // Not drawn, as behind the camera.
            return;
        this.speechBubbleHotspot.getWorldPosition(anchorTemp).project(GraphicsManager.getCamera());
        GraphicsManager.getGameRenderer().getSize(viewSizeTemp);
        const top = (1 - anchorTemp.y) / 2 * viewSizeTemp.y - height;
        const left = (1 + anchorTemp.x) / 2 * viewSizeTemp.x - 0.5 * width;
        const lowered = Math.max(0, Math.round(VIEW_MARGIN_PX - top));
        const shifted = Math.round((left < VIEW_MARGIN_PX) ? VIEW_MARGIN_PX - left
            : Math.min(0, viewSizeTemp.x - VIEW_MARGIN_PX - (left + width)));
        if (lowered == this.lowered && shifted == this.shifted)
            return;
        this.lowered = lowered;
        this.shifted = shifted;
        this.bubbleElement.style.top = `${lowered}px`;
        this.bubbleElement.style.left = `${shifted}px`;
        this.bubbleElement.style.transformOrigin = (lowered > 0) ? "top" : "";
    }

    // While the orbit frames this speaker, skip the bubble's own occlusion test: it disagrees
    // momentarily with OrbitOcclusionHider during camera turns, causing blinks.
    private orbitCameraIsFramingSpeaker(): boolean
    {
        const mode = cameraModeObservable.peek();
        return mode.type === "orbit" &&
            Geometry3DUtil.pointOverlapsAABB(this.gameObject.position, mode.target);
    }

    // Bounces on every line it shows, local or remote, but not as one clears (a message's time running out, see
    // PlayerMessageExpiryUtil), nor while a speaker shows only what it is busy with, under its name.
    private displayMessage(message: string, animate: boolean): void
    {
        this.message = message;
        const prepend = this.componentConfig.prependUserNameToMessage;
        const activity = SpeakerActivityUtil.get(this.gameObject.params);
        const busyElsewhere = SpeakerActivityUtil.replacesWords(activity);
        const saying = !busyElsewhere && message.length > 0;

        if (!prepend && !busyElsewhere && !saying)
        {
            this.hideSpeechBubble();
            return;
        }

        const segments = saying ? MessageLinkUtil.parse(message) : [];
        this.showSpeechBubble();
        this.bubbleElement!.replaceChildren();
        this.bubbleElement!.style.maxWidth = this.getMaxWidth(segments);

        if (prepend)
        {
            const userName = this.gameObject.getSpeakerName();
            const userNameSpan = document.createElement("span");
            userNameSpan.style.color = "oklch(87.9% 0.169 91.605)";
            userNameSpan.textContent = userName + (saying ? ":" : "");
            // Someone writing a line, or a helper thinking of an answer, its last words still up.
            if (activity == SpeakerActivityEnumMap.Typing || performance.now() < this.thinkingExpectedUntil)
                userNameSpan.appendChild(createTypingDots());
            this.bubbleElement!.appendChild(userNameSpan);

            if (busyElsewhere || saying)
                this.bubbleElement!.appendChild(document.createElement("br"));
        }

        if (busyElsewhere)
            this.bubbleElement!.appendChild(createActivityLine(ACTIVITY_LINES[activity]));
        for (const segment of segments)
        {
            this.bubbleElement!.appendChild((segment.kind == "text") ? document.createTextNode(segment.text)
                : (segment.kind == "link") ? createLinkButton(segment.href, segment.label)
                : ScreenControlPictureUtil.create(segment.control));
        }

        if (animate && saying)
            this.playBounce();
    }

    // In characters, as many as the message needs to take no more than MAX_LINES_AT_TYPE_WIDTH lines however its words
    // wrap: a line falls short of the width by less than the longest word. A line may break on either side of a wide
    // character, as at a space, and of a link or a picture, which is a word as wide as it is drawn.
    private getMaxWidth(segments: MessageSegment[]): string
    {
        const typeWidth = this.componentConfig.widthInChars ?? DEFAULT_WIDTH_IN_CHARS;
        let messageWidth = 0;
        let wordWidth = 0;
        let longestWordWidth = 0;
        for (const segment of segments)
        {
            if (segment.kind != "text")
            {
                const drawnWidth = (segment.kind == "link") ? Array.from(segment.label).length + LINK_BUTTON_EXTRA_CHARS
                    : ScreenControlPictureUtil.getWidthInChars(segment.control);
                messageWidth += drawnWidth;
                wordWidth = 0;
                longestWordWidth = Math.max(longestWordWidth, drawnWidth);
                continue;
            }
            for (const char of segment.text)
            {
                const wide = WIDE_CHARACTER.test(char);
                messageWidth += wide ? 2 : 1;
                wordWidth = (wide || /\s/.test(char)) ? 0 : wordWidth + 1;
                longestWordWidth = Math.max(longestWordWidth, wide ? 2 : wordWidth);
            }
        }
        const width = Math.min(MAX_WIDENING * typeWidth,
            Math.max(typeWidth, Math.ceil(messageWidth / MAX_LINES_AT_TYPE_WIDTH) + longestWordWidth));
        return `min(${width}ch, calc(100vw - ${2 * VIEW_MARGIN_PX}px - ${2 * PADDING_X_REM}rem))`;
    }

    // Scales bubbleElement, since the renderer overwrites the CSS2D root's transform each frame.
    private playBounce(): void
    {
        this.bubbleElement?.animate(
            [
                { transform: "scale(1)" },
                { transform: "scale(1.4)" },
                { transform: "scale(1)" },
            ],
            { duration: 350, easing: "ease-out" });
    }

    private showSpeechBubble(): void
    {
        if (!this.textElement)
        {
            this.textElement = document.createElement("div");
            this.textElement.style = "position:absolute; font-size:0.75rem; pointer-events:none;"; // font-size (inherited by the child) is then driven per-frame in update().

            this.bubbleElement = document.createElement("div");
            // Relative, so that it can be moved into view (see keepInView) without moving the root the renderer places.
            // Its text's width, its padding aside, is the message's (see getMaxWidth).
            this.bubbleElement.style = `position:relative; margin:auto auto; box-sizing:content-box; padding:0.2rem ${PADDING_X_REM}rem; color:white; background-color:rgba(0, 0, 0, 0.75); border-radius:0.4rem; text-align:center; white-space:normal;`;
            this.lowered = 0;
            this.shifted = 0;
            this.textElement.appendChild(this.bubbleElement);

            this.textCSS2DObject = new CSS2DObject(this.textElement);
            this.speechBubbleHotspot.add(this.textCSS2DObject);
            this.textCSS2DObject.center.set(0.5, 1);
            this.textCSS2DObject.position.set(0, 0, 0);
        }
    }

    private hideSpeechBubble(): void
    {
        if (this.textElement)
        {
            this.textElement?.remove();
            this.textElement = undefined;
            this.bubbleElement = undefined;
            this.textCSS2DObject?.removeFromParent();
            this.textCSS2DObject = undefined;
        }
    }
}

// A link in a message, as a button that opens it (see MessageLinkOpenUtil). Its address shows when the pointer rests on
// it, since its label is whatever its sender wrote.
function createLinkButton(href: string, label: string): HTMLElement
{
    const button = document.createElement("span");
    button.className = "speechBubbleLink yj-link-button";
    button.title = href;
    button.append(label, createLinkIcon());
    OverlayClickTargetUtil.makeClickable(button, () => MessageLinkOpenUtil.open(href));
    return button;
}

// A word and its dots, which come one by one and go together, each at a step rather than a fade. Dots not yet come keep
// their room, so the line stays where it is.
function createActivityLine({word, color}: {word: string, color: string}): HTMLElement
{
    const line = document.createElement("span");
    line.style = `color:${color}; font-weight:bold;`;
    line.append(word);
    for (let i = 1; i <= 3; ++i)
    {
        const dot = document.createElement("span");
        dot.textContent = ".";
        dot.animate([{opacity: 0, easing: "step-end"}, {opacity: 1, offset: i / 4}, {opacity: 1}],
            {duration: ACTIVITY_DOTS_CYCLE_MS, iterations: Infinity});
        line.append(dot);
    }
    return line;
}

// Three dots in the name's color, swelling and shrinking one after another. In ems, so that they scale with the bubble.
function createTypingDots(): HTMLElement
{
    const dots = document.createElement("span");
    dots.style = "display:inline-flex; align-items:center; gap:0.18em; height:1em; margin-left:0.35em;"
        + " vertical-align:-0.15em;";
    for (let i = 0; i < 3; ++i)
    {
        const dot = document.createElement("span");
        dot.style = "width:0.32em; height:0.32em; border-radius:50%; background-color:currentColor;";
        dot.animate([{transform: "scale(0.6)", easing: "ease-out"},
            {transform: "scale(1.35)", offset: 0.25, easing: "ease-in"},
            {transform: "scale(0.6)", offset: 0.55},
            {transform: "scale(0.6)"}],
            {duration: TYPING_DOT_CYCLE_MS, delay: i * TYPING_DOT_LAG_MS, fill: "backwards", iterations: Infinity});
        dots.append(dot);
    }
    return dots;
}

// An arrow out of the bubble, up and to the right.
function createLinkIcon(): SVGElement
{
    const icon = document.createElementNS(SVG_NAMESPACE, "svg");
    icon.setAttribute("viewBox", "0 0 12 12");
    icon.setAttribute("style", "width:0.8em; height:0.8em; margin-left:0.25em; flex-shrink:0;");
    const arrow = document.createElementNS(SVG_NAMESPACE, "path");
    arrow.setAttribute("d", "M4.5 2.5h5v5M9.5 2.5l-7 7");
    arrow.setAttribute("style", "fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round;");
    icon.append(arrow);
    return icon;
}
