import { useState } from "react";
import Text from "../basic/text";
import IconButton from "../basic/iconButton";
import CloseIcon from "../basic/icons/closeIcon";
import AtlasCellSprite from "../image/atlasCellSprite";
import App from "../../../app";
import ClientObjectManager from "../../../object/clientObjectManager";
import PopupUtil from "../../util/popupUtil";
import SocketsClient from "../../../networking/client/socketsClient";
import SetObjectMetadataSignal from "../../../../shared/object/types/setObjectMetadataSignal";
import useMouseDragScroll from "../../util/mouseDragScroll";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";

export default function CustomizePlayerForm()
{
    const onRefChange = useMouseDragScroll("horizontal", "alwaysGrab");
    const materialParams = PlayerBodyConfig.getMaterialParams();
    const numCols = materialParams.textureWidth / materialParams.textureGridCellWidth;

    // One {textureIndex, colorHex} per body part, in PlayerBodyConfig order (the appearance contract).
    const [parts, setParts] = useState<{ textureIndex: number; colorHex: number }[]>(readInitialParts);

    const setPart = (partIndex: number, change: Partial<{ textureIndex: number; colorHex: number }>) =>
    {
        setParts(prev =>
        {
            const next = prev.map((part, i) => i === partIndex ? { ...part, ...change } : part);
            applyAndBroadcast(next);
            return next;
        });
    };

    return <div className="absolute bottom-0 left-0 w-full z-40 flex flex-col pointer-events-none">
        <div className="m-2 p-2 flex flex-col gap-2 max-h-[30vh] bg-gray-700/90 rounded-lg pointer-events-auto">
            <div className="flex flex-row items-center gap-2">
                <Text content="Customize Character" size="sm"/>
                <IconButton icon={<CloseIcon/>} size="sm" onClick={PopupUtil.closePopup} additionalClassNames="ml-auto"/>
            </div>

            {/* One column of controls per body part, laid out left-to-right and scrolled horizontally
                when they don't all fit: a name + color picker on top, then the selectable texture cells. */}
            <div ref={onRefChange} className="flex flex-row items-stretch gap-3 w-full overflow-x-auto no-scrollbar">
                {PlayerBodyConfig.parts.map((partConfig, partIndex) =>
                    <div key={partConfig.name} className="flex flex-row items-stretch gap-3 shrink-0">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                            <div className="flex flex-row items-center gap-2">
                                <Text content={partConfig.name} size="sm"/>
                                <input
                                    type="color"
                                    className="w-8 h-8 p-0 shrink-0 bg-transparent border-2 border-gray-400 rounded-md cursor-pointer"
                                    value={toCssColor(parts[partIndex].colorHex)}
                                    onChange={(e) => setPart(partIndex, { colorHex: parseInt(e.target.value.slice(1), 16) })}
                                />
                            </div>
                            <div className="flex flex-row gap-1 shrink-0">
                                {partConfig.textureChoices.map((textureIndex) =>
                                    <AtlasCellSprite
                                        key={`${partConfig.name}.${textureIndex}`}
                                        atlasImageURL={materialParams.texturePath}
                                        atlasWidth={materialParams.textureWidth} atlasHeight={materialParams.textureHeight}
                                        atlasCellWidth={materialParams.textureGridCellWidth} atlasCellHeight={materialParams.textureGridCellHeight}
                                        atlasCellCol={textureIndex % numCols} atlasCellRow={Math.floor(textureIndex / numCols)}
                                        flipRow={true}
                                        highlight={textureIndex === parts[partIndex].textureIndex}
                                        autoScrollToHighlight={false}
                                        additionalClassNames="w-12 h-12 shrink-0 cursor-pointer rounded"
                                        onClick={() => setPart(partIndex, { textureIndex })}
                                    />
                                )}
                            </div>
                        </div>
                        {partIndex < PlayerBodyConfig.parts.length - 1 &&
                            <div className="w-px self-stretch bg-gray-500"/>}
                    </div>
                )}
            </div>
        </div>
    </div>;
}

// Reads the user's current appearance from their own player object (restored into its metadata at spawn),
// defaulting to each part's config default for anything unset or malformed.
function readInitialParts(): { textureIndex: number; colorHex: number }[]
{
    const myPlayer = ClientObjectManager.getMyPlayer();
    const entry = myPlayer?.params.metadata[ObjectMetadataKeyEnumMap.InstancedMeshComposition];
    return PlayerBodyConfig.resolveAppearance(entry?.str);
}

// Applies the appearance to the local player object (optimistic + persisted locally) and, in a multiplayer
// room, broadcasts it so other clients re-render the parts. Mirrors the canvas image-metadata flow.
function applyAndBroadcast(parts: { textureIndex: number; colorHex: number }[]): void
{
    const room = App.getCurrentRoom();
    const myPlayer = ClientObjectManager.getMyPlayer();
    if (!room || !myPlayer)
        return;

    const objectId = myPlayer.params.objectId;
    const value = PlayerBodyConfig.encodeAppearance(parts);
    if (!ClientObjectManager.setObjectMetadata(objectId, ObjectMetadataKeyEnumMap.InstancedMeshComposition, value))
        return;

    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetObjectMetadataSignal(
            new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.InstancedMeshComposition, value));
}

// A 0xRRGGBB number → the "#rrggbb" string that <input type="color"> and CSS backgroundColor expect.
function toCssColor(colorHex: number): string
{
    return "#" + (colorHex & 0xFFFFFF).toString(16).padStart(6, "0");
}
