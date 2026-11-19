import IconButton from "../../input/iconButton";
import TrashIcon from "../../../svg/icons/trashIcon";
import PictureFrameIcon from "../../../svg/icons/pictureFrameIcon";
import PaletteColorInput from "../../input/paletteColorInput";
import StepperInput from "../../input/stepperInput";
import Text from "../../basic/text";
import ObjectEditUtil from "../../../util/objectEditUtil";
import CompositionThumbnailPanel from "../../panel/compositionThumbnailPanel";
import MirrorObjectTypeConfig, { MIRROR_COLOR_PALETTE_NAME,
    NUM_MIRROR_OPACITY_STEPS } from "../../../../../shared/object/types/objectTypeConfig/mirrorObjectTypeConfig";
import { ObjectMetadataKeyEnumMap } from "../../../../../shared/object/types/objectMetadataKey";
import { SUB_PANELS_BENEATH_SELECTION_TOOLS } from "../../../../system/clientConstants";
import SelectionToolRow from "./selectionToolRow";
import EditOptionsProps from "../../../types/editOptionsProps";

const OPACITY_LABELS = Array.from({length: NUM_MIRROR_OPACITY_STEPS},
    (_, step) => `${Math.round(100 * step / (NUM_MIRROR_OPACITY_STEPS - 1))}%`);

// Admin tools for a selected mirror: remove, frame (one of its looks, the first frameless), and its surface's color and
// opacity over the reflection (one stored setting). The frame list shows beneath this row, its button a toggle, or in
// its place until closed (see SUB_PANELS_BENEATH_SELECTION_TOOLS).
export default function MirrorEditOptions(props: EditOptionsProps)
{
    // Read off the mirror each render, as every edit of it re-announces the selection (see ClientObjectManager).
    const obj = props.selection.gameObject.params;
    const surface = {
        colorIndex: MirrorObjectTypeConfig.util.getColorIndex(obj),
        opacityStep: MirrorObjectTypeConfig.util.getOpacityStep(obj),
    };
    const apply = (edit: (next: typeof surface) => void) => {
        const next = {...surface};
        edit(next);
        ObjectEditUtil.trySetObjectMetadata(props.selection, ObjectMetadataKeyEnumMap.MirrorProperties,
            MirrorObjectTypeConfig.util.encodeMirrorProperties(next.colorIndex, next.opacityStep));
    };

    // Recomputed each render; zone changes re-announce the selection (see ClientVoxelManager). Where the mirror can't
    // be edited, a list beneath this row stays up with nothing in it to pick, and one in its place isn't raised.
    const canEdit = ObjectEditUtil.canEditObject(props.selection);
    const canRaisePanel = SUB_PANELS_BENEATH_SELECTION_TOOLS || canEdit;
    const customizingFrame = canRaisePanel && props.openPanel == "compositionThumbnail";
    const toolsShown = SUB_PANELS_BENEATH_SELECTION_TOOLS || !customizingFrame;
    const closePanel = SUB_PANELS_BENEATH_SELECTION_TOOLS ? undefined : () => props.setOpenPanel(null);

    // Full width, so the rows can scroll horizontally instead of growing.
    return <div className="flex flex-col gap-1 w-full">
        {toolsShown && <SelectionToolRow>
            <IconButton id="removeMirrorButton" icon={<TrashIcon/>} size="md" color="red" shortcutKey="Delete"
                disabled={!ObjectEditUtil.canRemoveObject(props.selection)}
                onClick={() => ObjectEditUtil.openRemoveConfirmPopup(props.selection, "Want to remove this mirror?")}
            />
            <IconButton id="changeMirrorFrameButton" icon={<PictureFrameIcon/>} size="md"
                disabled={!canRaisePanel} highlight={customizingFrame}
                onClick={() => props.setOpenPanel("compositionThumbnail")}
            />
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Color" size="sm" additionalClassNames="shrink-0"/>
                <PaletteColorInput
                    paletteName={MIRROR_COLOR_PALETTE_NAME}
                    currValue={surface.colorIndex}
                    setColorIndex={(index) => apply(next => next.colorIndex = index)}
                    disabled={!canEdit}
                />
            </div>
            <div className="flex flex-row items-center gap-1 shrink-0">
                <Text content="Opacity" size="sm" additionalClassNames="shrink-0"/>
                <StepperInput
                    id="mirrorOpacityInput"
                    currValue={surface.opacityStep}
                    numValues={OPACITY_LABELS.length}
                    labels={OPACITY_LABELS}
                    setValue={(step) => apply(next => next.opacityStep = step)}
                    disabled={!canEdit}
                />
            </div>
        </SelectionToolRow>}
        {customizingFrame && <CompositionThumbnailPanel
            id="customizeMirrorOptions"
            objectType={MirrorObjectTypeConfig.objectType}
            currentCompositionIndex={ObjectEditUtil.getCompositionIndex(props.selection)}
            resumed={props.resumed}
            canChoose={() => canEdit}
            onChoose={(compositionIndex) => ObjectEditUtil.trySetCompositionIndex(props.selection, compositionIndex)}
            onClose={closePanel}
        />}
    </div>;
}
