// The tokens a reply took, as the Messages API reports them (see HelperChatUtil).
type HelperChatUsage = {input_tokens?: number, output_tokens?: number, cache_creation_input_tokens?: number,
    cache_read_input_tokens?: number};

export default HelperChatUsage;
