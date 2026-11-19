// What one person or agent has said to a helper since it last answered them (see HelperAgentUtil).
type HelperPendingLines = {isAgent: boolean, lines: string[], lastAt: number};

export default HelperPendingLines;
