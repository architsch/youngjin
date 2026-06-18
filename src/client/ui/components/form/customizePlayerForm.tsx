import { useState } from "react";
import Form from "../basic/form";
import Text from "../basic/text";
import AtlasCellSprite from "../image/atlasCellSprite";
import App from "../../../app";
import ClientObjectManager from "../../../object/clientObjectManager";
import PlayerBodyConfig from "../../../object/types/playerBodyConfig";
import SocketsClient from "../../../networking/client/socketsClient";
import SetObjectMetadataSignal from "../../../../shared/object/types/setObjectMetadataSignal";
import { ObjectMetadataKeyEnumMap } from "../../../../shared/object/types/objectMetadataKey";
import { RoomTypeEnumMap } from "../../../../shared/room/types/roomType";

// Lets the user pick, per body part, an atlas texture cell + a color tint for their own player character.
// Each change is applied to the local player object (so it persists + is read back here) and broadcast to
// the room (other clients render it). The user is in first-person and can't see their own body in-world,
// so a small 2D preview stands in — it multiplies the chosen color over the cell, mirroring the in-world
// tint (diffuseColor.rgb *= vColor). All body layout/defaults/choices come from PlayerBodyConfig.
export default function CustomizePlayerForm()
{
    const materialParams = PlayerBodyConfig.getMaterialParams();
    const numCols = materialParams.textureWidth / materialParams.textureGridCellWidth;

    // One {textureIndex, colorHex} per body part, in PlayerBodyConfig order (the PlayerAppearance contract).
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

    // A single tinted atlas-cell tile for the preview, looked up by the part's config name so the
    // formation layout stays correct regardless of the parts' ordering.
    const renderPreviewTile = (partName: string, sizeClassNames: string) =>
    {
        const partIndex = PlayerBodyConfig.parts.findIndex(part => part.name === partName);
        if (partIndex < 0)
            return <div className={sizeClassNames}/>;
        const part = parts[partIndex];
        return <div className={`${sizeClassNames} rounded-md overflow-hidden`} style={{ backgroundColor: toCssColor(part.colorHex) }}>
            <AtlasCellSprite
                atlasImageURL={materialParams.texturePath}
                atlasWidth={materialParams.textureWidth} atlasHeight={materialParams.textureHeight}
                atlasCellWidth={materialParams.textureGridCellWidth} atlasCellHeight={materialParams.textureGridCellHeight}
                atlasCellCol={part.textureIndex % numCols} atlasCellRow={Math.floor(part.textureIndex / numCols)}
                flipRow={true}
                highlight={false} autoScrollToHighlight={false}
                additionalClassNames="w-full h-full mix-blend-multiply"
            />
        </div>;
    };

    const emptyTile = <div className="w-12"/>;

    return <Form>
        <Text content="Customize Character" size="md"/>

        {/* Live preview of the floating-limb formation: head on top, hands flanking the torso, tail below. */}
        <div className="flex flex-col items-center gap-1 p-2 bg-gray-800/50 rounded-md">
            {renderPreviewTile("Head", "w-12")}
            <div className="flex flex-row items-center gap-1">
                {renderPreviewTile("Left hand", "w-9")}
                {renderPreviewTile("Torso", "w-12")}
                {renderPreviewTile("Right hand", "w-9")}
            </div>
            {renderPreviewTile("Tail", "w-10")}
        </div>

        {/* One row of controls per body part: name + color picker, then the selectable texture cells. */}
        {PlayerBodyConfig.parts.map((partConfig, partIndex) =>
            <div key={partConfig.name} className="flex flex-col gap-1">
                <div className="flex flex-row items-center gap-2">
                    <Text content={partConfig.name} size="sm"/>
                    <input
                        type="color"
                        className="w-8 h-8 p-0 shrink-0 bg-transparent border-2 border-gray-400 rounded-md cursor-pointer"
                        value={toCssColor(parts[partIndex].colorHex)}
                        onChange={(e) => setPart(partIndex, { colorHex: parseInt(e.target.value.slice(1), 16) })}
                    />
                </div>
                <div className="flex flex-row gap-2 p-2 overflow-x-auto bg-gray-800/50 rounded-md">
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
                            additionalClassNames="w-12 shrink-0 cursor-pointer rounded"
                            onClick={() => setPart(partIndex, { textureIndex })}
                        />
                    )}
                </div>
            </div>
        )}
    </Form>;
}

// Reads the user's current appearance from their own player object (restored into its metadata at spawn),
// defaulting to each part's config default for anything unset or malformed.
function readInitialParts(): { textureIndex: number; colorHex: number }[]
{
    const myPlayer = ClientObjectManager.getMyPlayer();
    const entry = myPlayer?.params.metadata[ObjectMetadataKeyEnumMap.PlayerAppearance];
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
    if (!ClientObjectManager.setObjectMetadata(objectId, ObjectMetadataKeyEnumMap.PlayerAppearance, value))
        return;

    if (room.roomType != RoomTypeEnumMap.SinglePlayer)
        SocketsClient.emitSetObjectMetadataSignal(
            new SetObjectMetadataSignal(room.id, objectId, ObjectMetadataKeyEnumMap.PlayerAppearance, value));
}

// A 0xRRGGBB number → the "#rrggbb" string that <input type="color"> and CSS backgroundColor expect.
function toCssColor(colorHex: number): string
{
    return "#" + (colorHex & 0xFFFFFF).toString(16).padStart(6, "0");
}
