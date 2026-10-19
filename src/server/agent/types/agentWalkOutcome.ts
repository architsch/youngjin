// How a walk ended (see AgentBodyUtil.walk).
type AgentWalkOutcome = "arrived" | "blocked" | "timedOut" | "interrupted" | "noPath";

export default AgentWalkOutcome;
