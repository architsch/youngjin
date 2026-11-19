const ErrorUtil =
{
    getErrorMessage: (err: unknown): string =>
    {
        return (err instanceof Error)
            ? `Name: ${err.name}, Message: ${err.message}, Stack: ${err.stack ?? "N/A"}`
            : String(err);
    },
}

export default ErrorUtil;