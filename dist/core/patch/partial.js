/**
 * Helper to split a unified diff into individual hunks (chunks).
 */
export function splitDiff(diff) {
    if (!diff)
        return [];
    const lines = diff.split("\n");
    const hunks = [];
    let currentHunk = null;
    let header = [];
    let gatheringHeader = true;
    for (const line of lines) {
        if (line.startsWith("@@")) {
            gatheringHeader = false;
            if (currentHunk) {
                hunks.push(currentHunk);
            }
            currentHunk = {
                header: header.join("\n"),
                content: line,
                lines: [line]
            };
        }
        else if (gatheringHeader) {
            header.push(line);
        }
        else if (currentHunk) {
            currentHunk.lines.push(line);
            currentHunk.content += "\n" + line;
        }
    }
    if (currentHunk) {
        hunks.push(currentHunk);
    }
    return hunks.map((h, i) => ({
        id: i,
        header: h.header,
        content: h.content,
        lines: h.lines
    }));
}
/**
 * Rebuilds a unified diff from a selection of hunks.
 */
export function rebuildDiff(selectedHunks) {
    if (!selectedHunks || selectedHunks.length === 0)
        return "";
    // Group by header (file) to maintain valid unified diff structure
    const header = selectedHunks[0].header;
    const content = selectedHunks.map(h => h.content).join("\n");
    return header + "\n" + content + "\n";
}
