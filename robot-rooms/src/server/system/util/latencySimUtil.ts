/**
 * Dev-mode latency simulation for race-condition testing, configured by env vars:
 * SIMULATED_LATENCY_MS (HTTP and socket), SIMULATED_DB_LATENCY_MS (Firestore/Storage),
 * SIMULATED_LATENCY_JITTER_MS (± jitter). A base of 0 resolves immediately.
 */

const networkLatencyMs = parseInt(process.env.SIMULATED_LATENCY_MS || "0", 10);
const dbLatencyMs = parseInt(process.env.SIMULATED_DB_LATENCY_MS || "0", 10);
const jitterMs = parseInt(process.env.SIMULATED_LATENCY_JITTER_MS || "0", 10);

function getJitteredDelay(baseMs: number): number
{
    if (baseMs <= 0) return 0;
    const jitter = jitterMs > 0 ? Math.round((Math.random() * 2 - 1) * jitterMs) : 0;
    return Math.max(0, baseMs + jitter);
}

function delay(ms: number): Promise<void>
{
    if (ms <= 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
}

const LatencySimUtil =
{
    networkLatencyEnabled: networkLatencyMs > 0,
    dbLatencyEnabled: dbLatencyMs > 0,

    /** Simulates network latency (HTTP / Socket.IO). */
    simulateNetworkLatency: (): Promise<void> => delay(getJitteredDelay(networkLatencyMs)),

    /** Simulates DB latency (Firestore / Firebase Storage). */
    simulateDBLatency: (): Promise<void> => delay(getJitteredDelay(dbLatencyMs)),

    /** Returns a summary string for startup logging. */
    getConfigSummary: (): string =>
    {
        if (!networkLatencyMs && !dbLatencyMs) return "    Latency simulation: OFF";
        return [
            `    SIMULATED_LATENCY_MS: ${networkLatencyMs}`,
            `    SIMULATED_DB_LATENCY_MS: ${dbLatencyMs}`,
            `    SIMULATED_LATENCY_JITTER_MS: ${jitterMs}`,
        ].join("\n");
    },
};

export default LatencySimUtil;
