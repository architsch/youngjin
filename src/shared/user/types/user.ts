import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";
import EncodableEnum from "../../networking/types/encodableEnum";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { UNDEFINED_DOCUMENT_ID_CHAR } from "../../system/sharedConstants";
import { UserType, UserTypeEnumMap } from "./userType";

export default class User extends EncodableData
{
    id: string;
    userName: string;
    userType: UserType;
    email: string;
    tutorialStep: number;

    constructor(id: string | undefined, userName: string, userType: UserType, email: string,
        tutorialStep: number)
    {
        super();
        this.id = (id != undefined) ? id : "";
        this.userName = userName;
        this.userType = userType;
        this.email = email;
        this.tutorialStep = tutorialStep;
    }

    static fromString(userString: string): User
    {
        const fields = userString.split(" ");
        const id = fields[0];
        const userName = fields[1];
        const userType = parseInt(fields[2]);
        const email = fields[3];
        const tutorialStep = parseInt(fields[4]);

        if (isNaN(userType))
            throw new Error(`userType is NaN (userString = "${userString}")`);
        if (isNaN(tutorialStep))
            throw new Error(`tutorialStep is NaN (userString = "${userString}")`);

        return new User(id, userName, userType, email, tutorialStep);
    }

    toString(): string
    {
        return `${this.id} ${this.userName} ${this.userType} ${this.email} ${this.tutorialStep}`;
    }

    encode(bufferState: BufferState)
    {
        new EncodableByteString(this.id.length > 0 ? this.id : UNDEFINED_DOCUMENT_ID_CHAR).encode(bufferState);
        new EncodableByteString(this.userName).encode(bufferState);
        new EncodableEnum(this.userType, UserTypeEnumMap).encode(bufferState);
        new EncodableByteString(this.email).encode(bufferState);
        new EncodableRawByteNumber(this.tutorialStep).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        let id: string | undefined = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        if (id == UNDEFINED_DOCUMENT_ID_CHAR)
            id = undefined;
        const userName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const userType = (EncodableEnum.decodeWithParams(bufferState, UserTypeEnumMap) as EncodableEnum).enumValue;
        const email = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const tutorialStep = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new User(id, userName, userType, email, tutorialStep);
    }
}