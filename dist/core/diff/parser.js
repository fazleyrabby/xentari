/**
 * Parses a unified diff string into an array of structured line objects.
 */
export function parseDiff(diff) {
    const lines = diff.split("\n");
    const result = [];
    for (const line of lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
            result.push({ type: "add", value: line.slice(1) });
        }
        else if (line.startsWith("-") && !line.startsWith("---")) {
            result.push({ type: "remove", value: line.slice(1) });
        }
        else if (line.startsWith(" ") || line === "") {
            result.push({ type: "same", value: line.slice(1) || line });
        }
        // Skip headers like index, ---, +++, @@
    }
    return result;
}
