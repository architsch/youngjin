import { LocKey } from "../types/locKey";
import { LocMap } from "../types/locMap";

let lang = "en";

export function localize(locKey: LocKey): string
{
    return locMapByLang[lang][locKey] ?? locKey;
}

export function setLang(newLang: string)
{
    lang = newLang;
}

const locMap_en: LocMap = {
    "auth/error/userName/length": "Username must be between 4 and 16 characters long.",
    "auth/error/userName/chars": "Username can only contain alphabets, numbers, and underbar(_).",
    "auth/error/password/length": "Password must be between 6 and 24 characters long.",
    "auth/error/password/chars": "Password can only contain alphabets, numbers, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
    "auth/error/email/length": "Email address must not contain more than 64 characters.",
    "auth/error/email/chars": "Please enter a valid email address.",

    "auth/rule/userName/length": "Username must be between 4 and 16 characters long.",
    "auth/rule/userName/chars": "Username can only contain alphabets, numbers, and underbar(_).",
    "auth/rule/password/length": "Password must be between 6 and 24 characters long.",
    "auth/rule/password/chars": "Password can only contain alphabets, numbers, and the following special characters: ~`!@#$%^&*()-_+={}[]|\\:;\"'<>,.?/",
    "auth/rule/email/length": "Email address must not contain more than 64 characters.",
};

const locMapByLang: {[lang: string]: LocMap} = {
    "en": locMap_en,
}