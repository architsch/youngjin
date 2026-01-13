export default interface SQLQueryResponse<ReturnDataType>
{
    success: boolean;
    data: ReturnDataType[];
}