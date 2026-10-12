export default interface RoomFilePreviewProps
{
    image: ImageData; // the picture of the file's room (see RoomPreviewUtil)
    width: number; // how wide the picture is shown, in CSS pixels
    onConfirm: () => void;
    onCancel: () => void;
}
