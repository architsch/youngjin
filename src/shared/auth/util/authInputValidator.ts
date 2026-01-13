import { LocKey } from "../../localization/types/locKey";

const AuthInputValidator =
{
    // Find error in the given text, and return the error message's localization key (if there is an error).

    findErrorInUserName: (text: string): LocKey | null =>
    {
        if (text.length < 4 || text.length > 16)
            return "auth/error/userName/length";
        if (text != AuthInputValidator.sanitizeUserName(text))
            return "auth/error/userName/chars";
        return null;
    },
    findErrorInPassword: (text: string): LocKey | null =>
    {
        if (text.length < 6 || text.length > 24)
            return "auth/error/password/length";
        if (text != AuthInputValidator.sanitizePassword(text))
            return "auth/error/password/chars";
        return null;
    },
    findErrorInEmailAddress: (text: string): LocKey | null =>
    {
        if (text.length > 64)
            return "auth/error/email/length";
        const regex = /^[^\s@]+@[^\s@]+.[^\s@]+$/;
        if (!regex.test(text))
            return "auth/error/email/chars"
        return null;
    },
    findErrorInRoomName: (text: string): LocKey | null =>
    {
        if (text.length < 4 || text.length > 64)
            return "auth/error/roomName/length";
        if (text != AuthInputValidator.sanitizeRoomName(text))
            return "auth/error/roomName/chars";
        return null;
    },

    // Re-format the given text appropriately and return the resulting text.

    sanitizeUserName: (text: string): string =>
    {
        if (text.length > 16)
            text = text.substring(0, 16);
        return text.replace(/[^a-zA-Z0-9_]/g, "");
    },
    sanitizePassword: (text: string): string =>
    {
        if (text.length > 24)
            text = text.substring(0, 24);
        return text.replace(/[^a-zA-Z0-9~`!@#\$%\^&\*\(\)-_\+=\{\[\}\]\|\\:;"'<>,\.\?\/]/g, "");
    },
    sanitizeRoomName: (text: string): string =>
    {
        return AuthInputValidator.sanitizeRoomNameWithoutTrimming(text).trim();
    },
    sanitizeRoomNameWithoutTrimming: (text: string): string =>
    {
        if (text.length > 64)
            text = text.substring(0, 64);
        return text.replace(/[^a-zA-Z0-9~`!@#\$%\^&\*\(\)-_\+=\{\[\}\]\|\\:;"'<>,\.\?\/\s]/g, "")
            .replace(/\s+/g, " "); // replace multiple consecutive spaces with a single space.
    },
}

export default AuthInputValidator;