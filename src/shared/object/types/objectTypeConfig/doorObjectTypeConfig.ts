import { DoorCompositionCodec } from "../../../graphics/mesh/composition/types/compositionCodec/doorCompositionCodec";
import DoorCompositionConstants, { DOOR_FOOTPRINT_HEIGHT, DOOR_FOOTPRINT_WIDTH,
    DOOR_PANEL_ORIGIN_Y } from "../../../graphics/mesh/composition/types/compositionConstants/doorCompositionConstants";
import { InstancedMeshCompositionCodecTypeEnumMap } from "../../../graphics/mesh/composition/types/instancedMeshCompositionCodecType";
import ColorUtil from "../../../math/util/colorUtil";
import StringUtil from "../../../math/util/stringUtil";
import EncodableByteString from "../../../networking/types/encodableByteString";
import Room from "../../../room/types/room";
import RoomValidationUtil from "../../../room/util/roomValidationUtil";
import { HUB_ROOM_ID_KEYWORD, LABEL_COLOR_PALETTE_NAME } from "../../../system/sharedConstants";
import User from "../../../user/types/user";
import AddObjectSignal from "../addObjectSignal";
import ObjectTypeConfig from "./objectTypeConfig";
import ObjectTypeConfigMap from "../../maps/objectTypeConfigMap";
import WallAttachedObjectUtil from "../../util/wallAttachedObjectUtil";
import ObjectTransform from "../objectTransform";
import SetObjectMetadataSignal from "../setObjectMetadataSignal";
import SetObjectTransformSignal from "../setObjectTransformSignal";
import { DoorType, DoorTypeEnumMap } from "../doorType";
import { ObjectMetadataKeyEnumMap } from "../objectMetadataKey";

// The id every room's own way in is filed under. Fixed rather than drawn, so that a room converted
// from an older format gains exactly one of these however many times it is read, and so that the
// appearance derived from a door's id is the same door every session.
export const ENTRANCE_DOOR_OBJECT_ID = "entrance_door";

// Every door in the room draws its parts from one pool of mesh instances, so the room can only hold
// as many as that pool was sized for.
const MAX_DOORS_PER_ROOM = 16;
const MAX_MESH_INSTANCES_PER_DOOR = 8;

// The two ends of an arriving player's entrance, measured along the door's own facing direction from
// the face of the door he came through. A door's position sits on the boundary between the wall it
// hangs on and the room it faces (see WallAttachedObjectUtil), so half a voxel to either side of it
// is the middle of a voxel cell: the player is put down in the middle of the wall cell, with the door
// standing between him and the room, and walks out to the middle of the floor cell in front of it.
// Placing him behind the door is what makes his arrival a step out of it rather than a step up to it.
// See SpawnHotspotUtil, which puts him down, and PlayerController, which walks him out.
export const SPAWN_DIST_BEHIND_DOOR = 0.5;
export const ENTRANCE_DIST_IN_FRONT_OF_DOOR = 0.5;

// The metadata an admin is allowed to write onto a door. Everything a door is — where it leads, what
// it is called, whether it offers itself as a room's way in, and what it is finished in — is one of
// these; anything else arriving under a door's id is refused rather than stored.
const editableMetadataKeys = [
    ObjectMetadataKeyEnumMap.InstancedMeshComposition,
    ObjectMetadataKeyEnumMap.Label,
    ObjectMetadataKeyEnumMap.LabelColor,
    ObjectMetadataKeyEnumMap.DestinationRoomId,
    ObjectMetadataKeyEnumMap.DestinationDoorLabel,
    ObjectMetadataKeyEnumMap.DoorType,
];

// A door is a gateway from one room to another, hung on a wall like a picture. Laying one is an edit
// to the shape of the world rather than to a room's contents, so it is an admin's to make and only
// in a Hub — see RoomValidationUtil.canUserManageDoors.
const DoorObjectTypeConfig =
{
    objectType: "Door",
    persistent: true,
    autoUnload: true,
    maxCountPerRoom: MAX_DOORS_PER_ROOM,
    canUserAddObject: (user: User, room: Room, obj: AddObjectSignal) => {
        if (!RoomValidationUtil.canUserManageDoors(user, room))
            return false;

        // Block spoofing attempts
        if (obj.sourceUserID != user.id)
            return false;

        // The room can only hold as many doors as the mesh instance pool was sized for. The type
        // index is looked up on each call rather than captured at module scope: this file sits
        // inside an import cycle with the map, and a lookup made at load time would depend on which
        // module happened to be evaluated first.
        const typeIndex = ObjectTypeConfigMap.getIndexByType("Door");
        const doorCount = Object.values(room.objectById)
            .filter(obj => obj.objectTypeIndex === typeIndex).length;
        if (doorCount >= MAX_DOORS_PER_ROOM)
            return false;

        return true;
    },
    canUserRemoveObject: (user: User, room: Room, obj: AddObjectSignal) => {
        return RoomValidationUtil.canUserManageDoors(user, room);
    },
    canUserSetObjectTransform: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectTransformSignal) => {
        if (!RoomValidationUtil.canUserManageDoors(user, room))
            return false;

        // A door is slid along the wall by a gizmo, which is a placement rather than a motion.
        if (!signal.ignorePhysics)
            return false;

        return true;
    },
    canUserSetObjectMetadata: (user: User, room: Room, obj: AddObjectSignal, signal: SetObjectMetadataSignal) => {
        if (!RoomValidationUtil.canUserManageDoors(user, room))
            return false;

        // The values themselves are settled by ObjectMetadataEntryMap, which clamps a door type into
        // the enum and cuts a label to length, so what is left to ask here is only which keys a door
        // answers to at all.
        return editableMetadataKeys.includes(signal.metadataKey);
    },
    components: {
        spawnedByAny: {
            collider: {
                // A door lays claim to the stretch of wall it hangs on, so nothing else can be hung
                // over it — which the room's entrance door needs as much as an owner's own door
                // would, having spent every previous version of this object being hangable-over.
                // This is also where everything outside this file reads a door's footprint from.
                // The footprint is a round number of half-voxels; the box the door is actually
                // tested against is a hair inside it (see PhysicsColliderStateUtil).
                colliderType: "wallAttachment",
                hitboxSize: {sizeX: DOOR_FOOTPRINT_WIDTH, sizeY: DOOR_FOOTPRINT_HEIGHT, sizeZ: 0.01},
                applyHardCollisionToOthers: false, // pass-through: the wall behind already blocks the player
                outgoingSoftCollisionForceMultiplier: 0,
                incomingSoftCollisionForceMultiplier: 0,
                maxClimbableHeight: 0,
            },
            playerProximityDetector: {
                maxDist: 3.5,
                maxLookAngle: 0.25*Math.PI,
                // The door is a panel filling a doorway, and prompts only those standing in front
                // of its face. That rules out two positions a player really does end up in: behind
                // it, which is where he spawns on arriving in the room, looking straight through it
                // on his way out into the room; and flat against the wall beside it, where the
                // panel is edge-on and there is nothing of it left to see. Wide enough to keep the
                // whole approach to a door of this width, up to standing at the edge of the panel a
                // pace out from the wall.
                maxFaceAngle: Math.PI/4,
                checkLineOfSight: true, // A door across the room can stand behind anything built since.
            },
            speechBubble: {
                yOffset: 0.25,
                checkLineOfSight: false,
                prependUserNameToMessage: false,
            },
            instancedMeshGraphics: {},
            instancedMeshComposer: {
                maxNumInstancesPerMesh: MAX_DOORS_PER_ROOM * MAX_MESH_INSTANCES_PER_DOOR,
                codecType: InstancedMeshCompositionCodecTypeEnumMap.Door,
                codecVersion: 0,
                generateDefaultParts: (obj: AddObjectSignal) => {
                    // Seeded from where the door stands rather than from who is looking at it: a
                    // client-spawned object carries the viewing user's id (see ObjectFactory), so
                    // seeding from that would give every player in a room a different door. The
                    // room and the door's own id are the same for everyone and the same next
                    // session, which is what makes a room's door recognizably its own.
                    const hashCode = StringUtil.getHashCode(`${obj.roomID}/${obj.objectId}`);
                    return DoorCompositionCodec.getRandomComposition(hashCode);
                },
            },
            // The door's name goes where a sign belongs: on the plate, which is the one region of
            // its face finished differently for the purpose. The rect comes from the plate's own
            // declaration rather than being written out again, so the two cannot drift apart, and
            // it is inset by the moulding running around the plate so the text never rides over the
            // carving. It stands a little in front of the plate's own relief.
            labelText: {
                localOffset: {
                    x: DoorCompositionConstants.label.offset.x,
                    y: DOOR_PANEL_ORIGIN_Y + DoorCompositionConstants.label.offset.y,
                    z: DoorCompositionConstants.label.relief + 0.005,
                },
                size: {
                    x: DoorCompositionConstants.label.size.x
                        - 2 * DoorCompositionConstants.label.mouldingThickness,
                    y: DoorCompositionConstants.label.size.y
                        - 2 * DoorCompositionConstants.label.mouldingThickness,
                },
                defaultFontColorHex: "#33302c", // a dark grey that reads as lettering without going to black
            },
            orbitOccluder: {}, // Part of the wall it sits in, as far as the orbit camera is concerned.
        },
    },
    // Everything about a door that is a question of what it means rather than of how it is drawn:
    // where a room's own way in stands, and how to read the metadata a door carries.
    util: {
        // The door a multiplayer room is generated with — its way in, standing in the boundary wall
        // at the room's entrance cell and facing into the room.
        //
        // It is wired to the hubs, and that is not a default standing in for a decision nobody made:
        // a room's own way in is also its way out, and a door naming nowhere is a locked one, so a
        // room generated with an unwired entrance would be a room its visitors could not leave.
        // Which hub it opens onto is deliberately left unsaid — the keyword hands that to the
        // balancer at the moment somebody walks through, where naming one outright would pin every
        // room in the game to a hub that may since have filled up or been taken down.
        //
        // Both room generation and the conversion that carries older rooms across call this, so that
        // a room built today and a room migrated yesterday come out holding the same door.
        makeEntranceDoor: (roomID: string, entranceVoxelCol: number, entranceVoxelRow: number,
            entranceVoxelCollisionLayer: number): AddObjectSignal =>
        {
            const objectTypeIndex = ObjectTypeConfigMap.getIndexByType("Door");
            return new AddObjectSignal(roomID, "", "",
                objectTypeIndex, ENTRANCE_DOOR_OBJECT_ID,
                new ObjectTransform(
                    WallAttachedObjectUtil.getBoundaryWallAttachmentPos(objectTypeIndex,
                        entranceVoxelCol, entranceVoxelRow, entranceVoxelCollisionLayer),
                    WallAttachedObjectUtil.getBoundaryWallInwardDir(entranceVoxelCol, entranceVoxelRow)),
                {
                    [ObjectMetadataKeyEnumMap.DoorType]:
                        new EncodableByteString(`${DoorTypeEnumMap.DefaultEntrance}`),
                    [ObjectMetadataKeyEnumMap.DestinationRoomId]:
                        new EncodableByteString(HUB_ROOM_ID_KEYWORD),
                });
        },
        getLabel: (obj: AddObjectSignal): string =>
        {
            return obj.metadata[ObjectMetadataKeyEnumMap.Label]?.str ?? "";
        },
        // Which position in the lettering palette the object's name is written in. An object that has
        // never been told falls back on the color its type was given, matched to the nearest position
        // the palette holds — so the picker opens on the color the label is actually wearing rather
        // than on an arbitrary one, and picking that same swatch back changes nothing.
        getLabelColorIndex: (obj: AddObjectSignal): number =>
        {
            const stored = obj.metadata[ObjectMetadataKeyEnumMap.LabelColor]?.str;
            if (stored != undefined && stored.length > 0)
            {
                const index = parseInt(stored);
                if (!isNaN(index))
                    return index;
            }
            const configuredHex = ObjectTypeConfigMap.getConfigByIndex(obj.objectTypeIndex)
                .components.spawnedByAny?.labelText?.defaultFontColorHex;
            return ColorUtil.rgbToPaletteIndex(LABEL_COLOR_PALETTE_NAME,
                ColorUtil.hexToRGB(configuredHex ?? "#000000"));
        },
        getDestinationRoomId: (obj: AddObjectSignal): string =>
        {
            return obj.metadata[ObjectMetadataKeyEnumMap.DestinationRoomId]?.str ?? "";
        },
        getDestinationDoorLabel: (obj: AddObjectSignal): string =>
        {
            return obj.metadata[ObjectMetadataKeyEnumMap.DestinationDoorLabel]?.str ?? "";
        },
        // A door with nothing said about it is a custom entrance: a door somebody put up is one of
        // the room's ways in only once it says so.
        getDoorType: (obj: AddObjectSignal): DoorType =>
        {
            const metadata = obj.metadata[ObjectMetadataKeyEnumMap.DoorType];
            if (!metadata)
                return DoorTypeEnumMap.CustomEntrance;
            const doorType = parseInt(metadata.str);
            return isNaN(doorType) ? DoorTypeEnumMap.CustomEntrance : doorType;
        },
    },
} satisfies ObjectTypeConfig;

export default DoorObjectTypeConfig;
