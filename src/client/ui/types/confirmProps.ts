export default interface ConfirmProps
{
    message: string;
    // Shown under the message, broken anywhere to fit (e.g. a web address).
    detail?: string;
    onConfirm: () => void;
    onCancel: () => void;
}