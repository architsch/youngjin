const ErrorUtil =
{
    getErrorMessage: (err: unknown): string =>
    {
        return (err instanceof Error) ? err.message : String(err);
    },
}

export default ErrorUtil;