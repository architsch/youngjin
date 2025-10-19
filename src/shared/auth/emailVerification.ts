export default interface EmailVerification
{
    email: string;
    verificationCode: string;
    expirationTime: number;
}