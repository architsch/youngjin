import SQLUser from "../../db/types/sqlUser";
import BufferState from "../../networking/types/bufferState";
import EncodableByteString from "../../networking/types/encodableByteString";
import EncodableData from "../../networking/types/encodableData";
import EncodableEnum from "../../networking/types/encodableEnum";
import EncodableRaw4ByteNumber from "../../networking/types/encodableRaw4ByteNumber";
import EncodableRawByteNumber from "../../networking/types/encodableRawByteNumber";
import { UserType, UserTypeEnumMap } from "./userType";

export default class User extends EncodableData
{
    userID: number;
    userName: string;
    userType: UserType;
    email: string;
    tutorialStep: number;

    constructor(userID: number, userName: string, userType: UserType, email: string,
        tutorialStep: number)
    {
        super();
        this.userID = userID;
        this.userName = userName;
        this.userType = userType;
        this.email = email;
        this.tutorialStep = tutorialStep;
    }

    static fromString(userString: string): User
    {
        const fields = userString.split(" ");
        const userID = parseInt(fields[0]);
        const userName = fields[1];
        const userType = parseInt(fields[2]);
        const email = fields[3];
        const tutorialStep = parseInt(fields[4]);

        if (isNaN(userID))
            throw new Error(`userID is NaN (userString = "${userString}")`);
        if (isNaN(userType))
            throw new Error(`userType is NaN (userString = "${userString}")`);
        if (isNaN(tutorialStep))
            throw new Error(`tutorialStep is NaN (userString = "${userString}")`);

        return new User(userID, userName, userType, email, tutorialStep);
    }

    toString(): string
    {
        return `${this.userID} ${this.userName} ${this.userType} ${this.email} ${this.tutorialStep}`;
    }

    static fromSQL(sqlUser: SQLUser): User
    {
        return new User(
            sqlUser.userID,
            sqlUser.userName,
            sqlUser.userType,
            sqlUser.email,
            sqlUser.tutorialStep
        );
    }

    encode(bufferState: BufferState)
    {
        new EncodableRaw4ByteNumber(this.userID).encode(bufferState);
        new EncodableByteString(this.userName).encode(bufferState);
        new EncodableEnum(this.userType, UserTypeEnumMap).encode(bufferState);
        new EncodableByteString(this.email).encode(bufferState);
        new EncodableRawByteNumber(this.tutorialStep).encode(bufferState);
    }

    static decode(bufferState: BufferState): EncodableData
    {
        const userID = (EncodableRaw4ByteNumber.decode(bufferState) as EncodableRaw4ByteNumber).n;
        const userName = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const userType = (EncodableEnum.decodeWithParams(bufferState, UserTypeEnumMap) as EncodableEnum).enumValue;
        const email = (EncodableByteString.decode(bufferState) as EncodableByteString).str;
        const tutorialStep = (EncodableRawByteNumber.decode(bufferState) as EncodableRawByteNumber).n;
        return new User(userID, userName, userType, email, tutorialStep);
    }
}