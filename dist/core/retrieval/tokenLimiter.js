export function trimContext(context, maxTokens) {
    const str = JSON.stringify(context);
    if (str.length <= maxTokens)
        return context;
    if (context.functionBlock) {
        return { functionBlock: context.functionBlock };
    }
    return { file: (context.file || "").slice(0, maxTokens) };
}
