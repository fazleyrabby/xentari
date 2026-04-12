/**
* Constraint Engine to clean and validate LLM outputs.
*/
export function enforceConstraints(output, rules = [], metrics = null) {
    let result = output;
    let fixes = 0;
    for (const rule of rules) {
        const original = result;
        if (rule.type === "no_markdown") {
            // Remove code fences but keep content if it's just one block, 
            // or remove all blocks if that's the rule.
            // The spec says result = result.replace(/```[\s\S]*?```/g, "").trim();
            // but that might remove the code we want. 
            // Usually we want to EXTRACT from fences if they exist, or remove them if they surround everything.
            if (result.includes("```")) {
                result = result.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
                fixes++;
            }
        }
        if (rule.type === "no_explanations") {
            const lines = result.split("\n");
            const cleanedLines = lines.filter(line => {
                const lower = line.toLowerCase();
                return !lower.includes("here is") &&
                    !lower.includes("this code") &&
                    !lower.includes("explanation") &&
                    !lower.includes("certainly") &&
                    !lower.includes("i have");
            });
            if (cleanedLines.length !== lines.length) {
                result = cleanedLines.join("\n");
                fixes++;
            }
        }
        if (rule.type === "trim") {
            const trimmed = result.trim();
            if (trimmed !== result) {
                result = trimmed;
                fixes++;
            }
        }
        // Explicitly remove chunk boundary markers if they leaked into output
        if (result.includes("... [CHUNK BOUNDARY] ...")) {
            result = result.replace(/\n*\.\.\. \[CHUNK BOUNDARY\] \.\.\.\n*/g, "\n\n").trim();
            fixes++;
        }
    }
    if (metrics && fixes > 0) {
        metrics.constraintFixes = (metrics.constraintFixes || 0) + fixes;
    }
    return result;
}
export function validateFileOutput(content) {
    if (!content || content.length < 10) {
        return { valid: false, reason: "output too small or empty" };
    }
    if (content.includes("```")) {
        return { valid: false, reason: "markdown fences detected in cleaned output" };
    }
    // Check for common conversational filler that escaped enforceConstraints
    const lower = content.toLowerCase();
    if (lower.startsWith("here is") || lower.startsWith("certainly")) {
        return { valid: false, reason: "conversational prose detected" };
    }
    return { valid: true };
}
