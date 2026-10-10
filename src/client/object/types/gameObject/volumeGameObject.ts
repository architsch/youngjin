import GameObject from "./gameObject";
import GraphicsManager from "../../../graphics/graphicsManager";
import WorldSpaceCaptionedButton from "../../../graphics/types/gizmo/generic/worldSpaceCaptionedButton";
import WorldSpaceOutlineBox from "../../../graphics/types/gizmo/generic/worldSpaceOutlineBox";
import WorldSpaceSelectionUtil from "../../../graphics/util/worldSpaceSelectionUtil";
import { objectSelectionObservable, selectionEditBlockedObservable } from "../../../system/clientObservables";
import { SELECTION_BLOCKED_COLOR, SELECTION_COLOR } from "../../../system/clientConstants";
import { ZONE_USER_NAME_FOR_NOBODY } from "../../../../shared/system/sharedConstants";
import AddObjectSignal from "../../../../shared/object/types/addObjectSignal";
import VolumeObjectTypeConfig from "../../../../shared/object/types/objectTypeConfig/volumeObjectTypeConfig";

// A volume that isn't selected is outlined white and dim, to tell it from the one that is.
const UNSELECTED_COLOR = "#ffffff";
const UNSELECTED_BRIGHTNESS = 0.45;

const centerTemp = {x: 0, y: 0, z: 0};
const sizeTemp = {x: 0, y: 0, z: 0};

// A named box of the room (see VolumeObjectTypeConfig), shown only in edit mode and only to who may select it: as
// the outline of its box, under its name. It has no surface to click, which would stand in the way of everything
// inside it, so a button over its top selects it. Selected, its outline is the selection's own, and its corners
// take the handles that resize it (see VolumeEditGizmos).
export default class VolumeGameObject extends GameObject
{
    private outline: WorldSpaceOutlineBox | null = null;
    private editButton: WorldSpaceCaptionedButton;
    private despawned: boolean = false;

    constructor(params: AddObjectSignal)
    {
        super(params);

        this.editButton = new WorldSpaceCaptionedButton("Edit", `volumeEditButton.${params.objectId}`);
        this.editButton.setOnClick(() => WorldSpaceSelectionUtil.trySelectManually(() => this.trySelect(-1)));
        this.editButton.addToParent(GraphicsManager.getScene());
        this.editButton.setVisible(false);
    }

    async onSpawn(): Promise<void>
    {
        await super.onSpawn();

        const outline = await WorldSpaceOutlineBox.create(UNSELECTED_COLOR);
        if (this.despawned)
        {
            outline.dispose();
            return;
        }
        outline.addToParent(GraphicsManager.getScene());
        this.outline = outline;
        this.refresh();
    }

    async onDespawn(): Promise<void>
    {
        this.despawned = true;
        await super.onDespawn();

        this.outline?.dispose();
        this.outline = null;
        this.editButton.dispose();
    }

    // Followed every frame: a drag resizes the box, and the mode, the selection and the name all change what shows.
    update(_deltaTime: number)
    {
        this.refresh();
    }

    private refresh()
    {
        const shown = this.canBeSelected();
        this.outline?.setVisible(shown);
        this.editButton.setVisible(shown);
        if (!shown)
            return;

        const {min, max} = VolumeObjectTypeConfig.util.getBox(this.params.transform);
        centerTemp.x = 0.5 * (min.x + max.x);
        centerTemp.y = 0.5 * (min.y + max.y);
        centerTemp.z = 0.5 * (min.z + max.z);
        sizeTemp.x = max.x - min.x;
        sizeTemp.y = max.y - min.y;
        sizeTemp.z = max.z - min.z;

        const selected = objectSelectionObservable.peek()?.gameObject === this;
        const selectedColor = selectionEditBlockedObservable.peek() ? SELECTION_BLOCKED_COLOR : SELECTION_COLOR;
        this.outline?.setBox(centerTemp, sizeTemp);
        this.outline?.setLook(selected ? selectedColor : UNSELECTED_COLOR, selected ? 1 : UNSELECTED_BRIGHTNESS,
            selected);

        this.editButton.setPosition(centerTemp.x, max.y, centerTemp.z);
        this.editButton.setCaption(getCaption(this.params));
        this.editButton.setButtonVisible(!selected);
        this.editButton.update();
    }
}

// A volume's name, and after it whom a restricted zone is kept for (see RestrictedZoneUtil).
function getCaption(params: AddObjectSignal): string
{
    const zoneUserName = VolumeObjectTypeConfig.util.getZoneUserName(params);
    const keptFor = (zoneUserName.length == 0) ? ""
        : ((zoneUserName == ZONE_USER_NAME_FOR_NOBODY) ? "for no user" : `for ${zoneUserName}`);
    return [VolumeObjectTypeConfig.util.getName(params), keptFor].filter(part => part.length > 0).join(" · ");
}
