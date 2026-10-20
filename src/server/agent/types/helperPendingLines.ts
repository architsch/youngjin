// What one person or agent has said to a helper since it last answered them (see HelperAgentUtil).
type HelperPendingLines = {name: string, isAgent: boolean, firstVisit: boolean, lines: string[], lastAt: number};

export default HelperPendingLines;
