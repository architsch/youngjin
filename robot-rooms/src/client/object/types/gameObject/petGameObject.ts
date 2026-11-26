import * as THREE from "three";
import GameObject from "./gameObject";
import InstancedMeshComposer from "../../components/instancedMeshComposer";
import InstancedMeshGraphics from "../../components/instancedMeshGraphics";
import SpeechBubble from "../../components/speechBubble";
import EasingMotion from "../../components/easingMotion";
import Rigidbody from "../../components/rigidbody";
import PetNamePlate from "../../components/helpers/pet/petNamePlate";
import ClientObjectManager from "../../clientObjectManager";
import PetDriverUtil from "../../util/petDriverUtil";
import PlayModeSelectionUtil from "../../../graphics/util/playModeSelectionUtil";
import WorldSpaceSelectionUtil from "../../../graphics/util/worldSpaceSelectionUtil";
import PetVoice from "../../../audio/types/petVoice";
import GameModeUtil from "../../../system/util/gameModeUtil";
import { petDrawnWidthsObservable, petSnoreObservable, petStrikeObservable } from "../../../system/clientObservables";
import Vec3 from "../../../../shared/math/types/vec3";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import { ObjectMetadataKey, ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../../shared/object/types/objectTransform";
import ObjectWaypoint from "../../../../shared/object/types/objectWaypoint";
import { PetActionEnumMap } from "../../../../shared/object/types/petAction";
import PetShownState from "../../../../shared/object/types/petShownState";
import { PetSpeechToneEnumMap } from "../../../../shared/object/types/petSpeechTone";
import NpcFacingUtil from "../../../../shared/object/util/npcFacingUtil";
import PetBehaviorUtil from "../../../../shared/object/util/petBehaviorUtil";
import PetBodyUtil from "../../../../shared/object/util/petBodyUtil";
import PetIdentityUtil from "../../../../shared/object/util/petIdentityUtil";
import PetPathSyncUtil from "../../../../shared/object/util/petPathSyncUtil";
import PetShownStateUtil, { PET_RUST_LEVELS } from "../../../../shared/object/util/petShownStateUtil";
import PetCompositionUtil from "../../../../shared/graphics/mesh/composition/util/petCompositionUtil";
import { PET_BODY_HEIGHT, PET_BODY_WIDTH,
    PET_HOP_HEIGHT } from "../../../../shared/graphics/mesh/composition/types/compositionConstants/petCompositionConstants";

// While it is excited it hops (see PET_HOP_HEIGHT): each hop this long, in seconds, one after another.
export const PET_HOP_SECONDS = 0.34;
// Asleep, it draws a breath this often, in seconds.
export const PET_SNORE_INTERVAL_SECONDS = 1.6;
// The box its selection is outlined by (see ObjectTypeClientConfig): its whole body's, wheels to top, and this much
// clear of it on every side.
const OUTLINE_MARGIN = 0.06;
export const PET_OUTLINE_BOX_SIZE: Vec3 = {x: PET_BODY_WIDTH + 2 * OUTLINE_MARGIN, y: PET_BODY_HEIGHT + 2 * OUTLINE_MARGIN,
    z: PET_BODY_WIDTH + 2 * OUTLINE_MARGIN};
// What its words are colored by what it speaks of (see PetSpeechToneEnumMap): its failing health in a bright red
// (Tailwind's red-500), its empty battery in a medium gray (its gray-400).
const WORDS_COLOR_BY_TONE: {[tone: number]: string | undefined} = {
    [PetSpeechToneEnumMap.Dying]: "oklch(63.7% 0.237 25.331)",
    [PetSpeechToneEnumMap.Powerless]: "oklch(70.7% 0.022 261.325)",
};
const LISTENER_KEY = "petGameObject";
let instanceCount = 0;

// A pet (see PetObjectTypeConfig, ServerPetObjectTypeConfig): all this does is show what whoever plays it tells of it.
// Its own user's browser plays it by physics (see PetDriverUtil); any other plays out the way it was told the pet
// goes (see PetPathSyncUtil), turning it to face where it goes. Its rust, its charge and its face are what its state
// shows; excited it hops, asleep it breathes, and each strike it deals is told once, to whatever shows and sounds one.
// Its voice says each line aloud, and what it feels with no words for it (see PetVoice).
export default class PetGameObject extends GameObject
{
    // What draws it hangs from this, which only a debug command ever narrows or widens (see petDrawnWidthsObservable):
    // never visualObj, which its hops pose (see EasingMotion), and never its collider or outline.
    private body: THREE.Object3D = new THREE.Object3D();
    private readonly widthListenerKey = `${LISTENER_KEY}${++instanceCount}`;
    private listeningForWidth: boolean = false;
    private instancedMeshComposer: InstancedMeshComposer;
    private speechBubble: SpeechBubble;
    private easingMotion: EasingMotion;
    private namePlate: PetNamePlate;
    private voice: PetVoice;
    private shown: PetShownState;
    // Whether it has been told what it shows: one added without it is told it only as it comes into the room.
    private stateTold: boolean;
    // The way it was last told to go, and the waypoint it goes to next (one this browser doesn't play).
    private way: ObjectWaypoint[] = [];
    private nextWaypoint: number = 0;
    // When that way was last played on, by the clock: a slow browser's frames are cut short (see App), which would
    // leave the pet behind where its room has it.
    private wayPlayedAt: number | undefined = undefined;
    // The way it faces as drawn, across the floor (see NpcFacingUtil), and the way it is to face: as it last showed it
    // stood, or went.
    private drawnFacing: number;
    private facing: number | undefined = undefined;
    private hopSecondsLeft: number = 0;
    private snoreSecondsLeft: number = 0;
    private spawned: boolean = false;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.instancedMeshComposer = this.components.instancedMeshComposer as InstancedMeshComposer;
        this.speechBubble = this.components.speechBubble as SpeechBubble;
        this.easingMotion = this.components.easingMotion as EasingMotion;
        if (!this.instancedMeshComposer || !this.speechBubble || !this.easingMotion)
            throw new Error("PetGameObject requires InstancedMeshComposer, SpeechBubble and EasingMotion components");

        this.obj.add(this.body);
        this.body.add(this.visualObj);
        this.namePlate = new PetNamePlate(this, this.components.instancedMeshGraphics as InstancedMeshGraphics, false);
        // What is printed on its body goes where its body is drawn, each time that is: turned, moved or hopping.
        this.instancedMeshComposer.instancesPlacedObservable.addListener(LISTENER_KEY, () => this.namePlate.place());
        this.voice = new PetVoice(params.objectId, params.metadata[ObjectMetadataKeyEnumMap.SentMessage]?.str ?? "");
        this.shown = PetShownStateUtil.getObjectState(params);
        this.stateTold = params.metadata[ObjectMetadataKeyEnumMap.PetState] != undefined;
        this.drawnFacing = PetBodyUtil.getFacing(params.transform.dir);
    }

    async onSpawn(): Promise<void>
    {
        this.showWidth(petDrawnWidthsObservable.peek());
        petDrawnWidthsObservable.addListener(this.widthListenerKey, widths => this.showWidth(widths));
        this.listeningForWidth = true;
        await super.onSpawn();
        await this.namePlate.load();
        this.showTone();
        this.spawned = true;
    }

    // Whether it is all there. Whoever added it here tells the server of it right then, so its user's browser plays it
    // only from then on (see PetDriverUtil): the server takes nothing told of a pet it doesn't know yet.
    isSpawned(): boolean
    {
        return this.spawned;
    }

    async onDespawn(): Promise<void>
    {
        this.instancedMeshComposer.instancesPlacedObservable.removeListener(LISTENER_KEY);
        if (this.listeningForWidth)
            petDrawnWidthsObservable.removeListener(this.widthListenerKey);
        this.listeningForWidth = false;
        this.namePlate.dispose();
        this.voice.stop();
        await super.onDespawn();
    }

    getSpeakerName(): string
    {
        return PetIdentityUtil.getObjectIdentity(this.params).name;
    }

    getShownState(): PetShownState
    {
        return this.shown;
    }

    // Its body's own, on a pet this browser plays.
    getRigidbody(): Rigidbody | undefined
    {
        return this.components.rigidbody as Rigidbody | undefined;
    }

    // Turns its body to look a way across the floor, at once: for whoever plays it by physics, which keeps the turn.
    face(facing: number): void
    {
        const turned = facing != this.drawnFacing;
        const dir = PetBodyUtil.getDir(facing);
        this.drawnFacing = facing;
        this.obj.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
        if (turned)
            this.notifyTransformChanged();
    }

    followPath(waypoints: ObjectWaypoint[])
    {
        this.way = waypoints;
        this.nextWaypoint = 0;
    }

    // A line said aloud that only this browser shows (see SpeechBubble.showNotice).
    sayAloud(text: string): void
    {
        this.voice.babble(text, this.shown, this.position);
    }

    onSetMetadata(key: ObjectMetadataKey, value: string)
    {
        super.onSetMetadata(key, value);
        if (key === ObjectMetadataKeyEnumMap.SentMessage)
            this.voice.onSaid(value, this.shown, this.position);
        if (key !== ObjectMetadataKeyEnumMap.PetState)
            return;
        const before = this.shown;
        this.shown = PetShownStateUtil.getObjectState(this.params);
        PetCompositionUtil.pose(this.instancedMeshComposer.getParts(), this.shown.rust, PET_RUST_LEVELS,
            this.shown.batteryLevel, this.shown.expression, this.shown.sleepy, this.shown.powerless);
        this.instancedMeshComposer.redrawParts();
        this.showTone();
        if (this.shown.hits != before.hits && this.shown.action == PetActionEnumMap.Attack)
            this.tellStrike();
        if (this.stateTold)
            this.voice.onShown(before, this.shown);
        this.stateTold = true;
    }

    // Its words in the color of what they speak of; and asking for a battery or a wrench, a click on them selects it, in
    // either mode, for its tools to give it one (see PetEditOptions).
    private showTone(): void
    {
        this.speechBubble.setWordsColor(WORDS_COLOR_BY_TONE[this.shown.tone]);
        const asksForHelp = this.shown.tone != PetSpeechToneEnumMap.Normal;
        this.speechBubble.setOnClick(asksForHelp ? () => this.selectToHelp() : undefined);
    }

    private selectToHelp(): void
    {
        if (GameModeUtil.getGameMode() == "play")
        {
            if (this.canBeSelectedInPlayMode())
                PlayModeSelectionUtil.select(this);
        }
        else
            WorldSpaceSelectionUtil.trySelectManually(() => this.trySelect(-1));
    }

    private showWidth(widths: {[name: string]: number}): void
    {
        const width = widths[this.getSpeakerName().toLowerCase()] ?? 1;
        if (width == this.body.scale.x)
            return;
        this.body.scale.x = width;
        this.notifyTransformChanged();
    }

    forEachOwnedInstance(visit: (instancedMeshId: string, instanceId: number) => void)
    {
        this.namePlate.forEachInstance(visit);
    }

    update(deltaTime: number)
    {
        if (PetDriverUtil.drive(this, deltaTime))
            this.wayPlayedAt = undefined;
        else
            this.followWay(deltaTime);

        const hops = this.shown.excited && this.shown.action != PetActionEnumMap.Dead;
        this.hopSecondsLeft -= deltaTime;
        if (hops && this.hopSecondsLeft <= 0)
        {
            this.hopSecondsLeft = PET_HOP_SECONDS;
            this.easingMotion.bounce({durationSeconds: PET_HOP_SECONDS, positionOffset: {x: 0, y: 2 * PET_HOP_HEIGHT, z: 0},
                oscillations: 0.5});
        }

        if (this.shown.action != PetActionEnumMap.Sleep)
            this.snoreSecondsLeft = 0;
        else if ((this.snoreSecondsLeft -= deltaTime) <= 0)
        {
            this.snoreSecondsLeft = PET_SNORE_INTERVAL_SECONDS;
            petSnoreObservable.set({position: {x: this.position.x, y: this.position.y + 0.5 * PET_BODY_HEIGHT,
                z: this.position.z}});
        }
        this.voice.update(this.position, performance.now());
    }

    // Plays out the way it was told to go, and turns it toward the way it stands facing, or else the way it goes, as
    // fast as one played turns (see PetBehaviorUtil.getTurnRate). The room's copy of it goes along, and its collider,
    // as each browser keeps them (see PetPathSyncUtil).
    private followWay(deltaTime: number)
    {
        const now = performance.now();
        const seconds = (this.wayPlayedAt == undefined) ? deltaTime : 0.001 * (now - this.wayPlayedAt);
        this.wayPlayedAt = now;

        const transform = this.params.transform;
        const pos = {...transform.pos};
        const moving = this.nextWaypoint < this.way.length;
        let wayFacing: number | undefined = undefined;
        if (moving)
        {
            const followed = PetPathSyncUtil.follow(this.way, this.nextWaypoint, pos, seconds);
            this.nextWaypoint = followed.next;
            wayFacing = followed.facing;
        }
        this.facing = this.shown.facing ?? wayFacing ?? this.facing;
        const turn = NpcFacingUtil.getTurn(this.drawnFacing, this.facing ?? this.drawnFacing);
        if (!moving && turn == 0)
            return;
        const step = Math.sign(turn) * Math.min(Math.abs(turn), PetBehaviorUtil.getTurnRate(this.shown.action) * seconds);
        this.drawnFacing = this.drawnFacing + step;
        ClientObjectManager.setObjectTransform(this.params.objectId,
            new ObjectTransform(pos, PetBodyUtil.getDir(this.drawnFacing), transform.scale), true, false);
    }

    // A strike lands between it and what it attacks, at its own height.
    private tellStrike()
    {
        const victim = ClientObjectManager.getObjectById(this.shown.targetId);
        const at: Vec3 = (victim == undefined) ? this.position
            : {x: 0.5 * (this.position.x + victim.position.x), y: this.position.y, z: 0.5 * (this.position.z + victim.position.z)};
        petStrikeObservable.set({position: {x: at.x, y: at.y, z: at.z}});
    }
}
