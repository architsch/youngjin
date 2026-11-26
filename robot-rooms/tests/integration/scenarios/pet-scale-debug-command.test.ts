/**
 * Integration tests: the debug command that draws the pets of a name narrower or wider, "petscale NAME P" (see
 * DebugCommandUtil, petDrawnWidthsObservable, PetGameObject): from what is typed, in any case and on any server, to the
 * share kept for the name and the count of its pets in the room; held to its range; what is no such command; and a pet
 * drawing its body that wide from side to side and nothing else of it so, through its hops, one of the name spawned
 * later as well, and one gone no longer told.
 * What draws a pet's printing (it needs a GPU) and its speech bubble (a DOM) are stubbed; the pet, its other components
 * and the matrices its parts are drawn by are real.
 */
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import * as THREE from "three";

vi.mock("../../../src/client/graphics/graphicsManager", async () => {
    const THREE = await import("three");
    const scene = new THREE.Scene();
    return { default: { getScene: () => scene, addObjectToScene: (obj: THREE.Object3D) => scene.add(obj) } };
});

vi.mock("../../../src/client/app", () => ({ default: { getUser: vi.fn(), getCurrentRoom: vi.fn(), getEnv: vi.fn() } }));

// Nothing here is sent: the command changes only what this browser draws.
vi.mock("../../../src/client/networking/client/socketsClient", () => ({ default: {} }));

vi.mock("../../../src/client/object/components/helpers/pet/petNamePlate", () => ({
    default: class PetNamePlateStub
    {
        async load() {}
        place() {}
        dispose() {}
        forEachInstance() {}
    },
}));

vi.mock("../../../src/client/object/components/speechBubble", () => ({
    default: class SpeechBubbleStub
    {
        setWordsColor() {}
        setOnClick() {}
    },
}));

import App from "../../../src/client/app";
import { notificationMessageObservable, petDrawnWidthsObservable } from "../../../src/client/system/clientObservables";
import DebugCommandUtil from "../../../src/client/system/util/debugCommandUtil";
import ObjectFactory from "../../../src/client/object/factories/objectFactory";
import EasingMotion from "../../../src/client/object/components/easingMotion";
import GameObject from "../../../src/client/object/types/gameObject/gameObject";
import InstancedPartUtil from "../../../src/client/graphics/util/instancedPartUtil";
import { PET_HOP_SECONDS } from "../../../src/client/object/types/gameObject/petGameObject";
import EncodableByteString from "../../../src/shared/networking/types/encodableByteString";
import ObjectTypeConfigMap from "../../../src/shared/object/maps/objectTypeConfigMap";
import AddObjectSignal from "../../../src/shared/object/types/addObjectSignal";
import { ObjectMetadataKeyEnumMap } from "../../../src/shared/object/types/objectMetadataKey";
import ObjectTransform from "../../../src/shared/object/types/objectTransform";
import PetIdentityUtil from "../../../src/shared/object/util/petIdentityUtil";
import User from "../../../src/shared/user/types/user";
import { UserTypeEnumMap } from "../../../src/shared/user/types/userType";
import { PET_HOP_HEIGHT } from "../../../src/shared/graphics/mesh/composition/types/compositionConstants/petCompositionConstants";

const ROOM_ID = "a-room";
const NAME = "Foo Bar";
// Facing east, so that its own side to side is the room's north to south.
const FACING_EAST = {x: 1, y: 0, z: 0};
const UNSCALED = {x: 1, y: 1, z: 1};

let objects: {[objectId: string]: AddObjectSignal} = {};
let spawned: GameObject[] = [];

function petSignal(objectId: string, name: string, objectType: string = "Pet"): AddObjectSignal
{
    const identity = {...PetIdentityUtil.decode(""), name};
    return new AddObjectSignal(ROOM_ID, "an-owner", "An Owner", ObjectTypeConfigMap.getIndexByType(objectType), objectId,
        new ObjectTransform({x: 10, y: 0.5, z: 20}, {...FACING_EAST}, {...UNSCALED}),
        {[ObjectMetadataKeyEnumMap.PetIdentity]: new EncodableByteString(PetIdentityUtil.encode(identity))});
}

// In the room, and spawned as a browser spawns what its room holds.
async function spawn(signal: AddObjectSignal): Promise<GameObject>
{
    objects[signal.objectId] = signal;
    const pet = ObjectFactory.createServerSideObject(signal);
    await pet.onSpawn();
    spawned.push(pet);
    return pet;
}

// How long a part of no size of its own is drawn along each of its pet's own axes (side to side, up, front to back),
// facing as the pet faces.
function drawnSize(pet: GameObject): {x: number, y: number, z: number}
{
    const matrix = InstancedPartUtil.bakePartMatrix(pet.visualObj, 0, 0, 0, 0, 0, 1, 1, 1, 1, new THREE.Matrix4());
    const column = (i: number) => new THREE.Vector3().setFromMatrixColumn(matrix, i).length();
    return {x: column(0), y: column(1), z: column(2)};
}

describe("the debug command that draws the pets of a name narrower or wider", () => {
    beforeEach(() => {
        objects = {};
        spawned = [];
        petDrawnWidthsObservable.set({});
        notificationMessageObservable.set("");
        (App.getEnv as Mock).mockReturnValue({mode: "dev"});
        (App.getUser as Mock).mockReturnValue(new User("someone", "someone", UserTypeEnumMap.Member, "", ""));
        (App.getCurrentRoom as Mock).mockImplementation(() => ({id: ROOM_ID, objectById: objects}));
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(async () => {
        for (const pet of spawned)
            await pet.onDespawn();
    });

    it("keeps, in any case typed and on any server, the share for the name in lower case, and counts its pets", () => {
        objects = {
            pet: petSignal("pet", NAME),
            serverPet: petSignal("serverPet", "FOO BAR", "ServerPet"),
            other: petSignal("other", "Foo"),
            scrap: petSignal("scrap", NAME, "PetScrap"),
        };
        for (const mode of ["dev", "prod"])
        {
            (App.getEnv as Mock).mockReturnValue({mode});
            DebugCommandUtil.run(`  PetScale  ${NAME.toUpperCase()}   60 `);
            expect(petDrawnWidthsObservable.peek()).toEqual({"foo bar": 0.6});
            expect(notificationMessageObservable.peek()).toBe("Petscale: foo bar drawn 60% as wide (2 in the room).");
        }

        DebugCommandUtil.run("petscale foo 62.5");
        expect(petDrawnWidthsObservable.peek()).toEqual({"foo bar": 0.6, "foo": 0.625});
        DebugCommandUtil.run("petscale nobody 150");
        expect(petDrawnWidthsObservable.peek()["nobody"]).toBe(1.5);
        expect(notificationMessageObservable.peek()).toContain("(0 in the room)");
    });

    it("holds the share to its range", () => {
        DebugCommandUtil.run("petscale foo 0");
        expect(petDrawnWidthsObservable.peek()["foo"]).toBe(0.01);
        DebugCommandUtil.run("petscale foo 5000");
        expect(petDrawnWidthsObservable.peek()["foo"]).toBe(10);
    });

    it("is no command without a name and a percentage after it", () => {
        for (const typed of ["petscale", "petscale foo", "petscale 60", "petscale foo -5", "petscale foo x",
            "petscale foo 1e3", "petscale foo 60%", "petscalefoo 60"])
        {
            notificationMessageObservable.set("");
            DebugCommandUtil.run(typed);
            expect(notificationMessageObservable.peek(), typed).toBe("Unknown debug command.");
        }
        expect(petDrawnWidthsObservable.peek()).toEqual({});
    });

    it("narrows a pet of the name from side to side alone, never its transform, and through its hops", async () => {
        const pet = await spawn(petSignal("pet", NAME));
        const other = await spawn(petSignal("other", "Foo"));
        expect(drawnSize(pet)).toEqual({x: expect.closeTo(1), y: expect.closeTo(1), z: expect.closeTo(1)});

        DebugCommandUtil.run(`petscale ${NAME} 60`);
        expect(drawnSize(pet)).toEqual({x: expect.closeTo(0.6), y: expect.closeTo(1), z: expect.closeTo(1)});
        expect(drawnSize(other)).toEqual({x: expect.closeTo(1), y: expect.closeTo(1), z: expect.closeTo(1)});
        // Across the way it faces: north to south.
        const matrix = InstancedPartUtil.bakePartMatrix(pet.visualObj, 0, 0, 0, 0, 0, 1, 1, 1, 1, new THREE.Matrix4());
        const across = new THREE.Vector3().setFromMatrixColumn(matrix, 0);
        expect(Math.abs(across.z)).toBeCloseTo(0.6);
        expect(across.x).toBeCloseTo(0);

        // Its collider and outline go by its transform, which keeps its size.
        expect(pet.obj.scale).toEqual(new THREE.Vector3(1, 1, 1));
        expect(pet.params.transform.scale).toEqual(UNSCALED);

        const hop = pet.components.easingMotion as EasingMotion;
        hop.bounce({durationSeconds: PET_HOP_SECONDS, positionOffset: {x: 0, y: 2 * PET_HOP_HEIGHT, z: 0}, oscillations: 0.5});
        hop.update(0.5 * PET_HOP_SECONDS);
        expect(pet.visualObj.position.y).toBeGreaterThan(0);
        expect(drawnSize(pet).x).toBeCloseTo(0.6);
        hop.update(PET_HOP_SECONDS);
        expect(pet.visualObj.position.y).toBe(0);
        expect(drawnSize(pet).x).toBeCloseTo(0.6);

        DebugCommandUtil.run(`petscale ${NAME} 100`);
        expect(drawnSize(pet).x).toBeCloseTo(1);
    });

    it("draws a pet of the name that comes later as wide, and tells one gone no more", async () => {
        DebugCommandUtil.run(`petscale ${NAME} 140`);
        const pet = await spawn(petSignal("pet", NAME, "ServerPet"));
        expect(drawnSize(pet).x).toBeCloseTo(1.4);

        await pet.onDespawn();
        spawned = [];
        DebugCommandUtil.run(`petscale ${NAME} 50`);
        expect(drawnSize(pet).x).toBeCloseTo(1.4);
    });
});
