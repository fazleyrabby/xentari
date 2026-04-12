/**
 * Smart Chunker for handling large files with limited context windows.
 */
/**
 * Splits text into chunks of roughly equal size.
 * @param {string} text
 * @param {number} size
 * @returns {string[]}
 */
export function chunkText(text, size = 800) {
    if (!text)
        return [];
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + size));
        i += size;
    }
    return chunks;
}
/**
 * Scores a chunk based on keyword relevance to the task.
 * @param {string} chunk
 * @param {string} task
 * @returns {number}
 */
function scoreChunk(chunk, task) {
    const words = task.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const lowerChunk = chunk.toLowerCase();
    let score = 0;
    for (const word of words) {
        if (lowerChunk.includes(word)) {
            score++;
            // Bonus for multiple occurrences
            const occurrences = lowerChunk.split(word).length - 1;
            score += Math.min(occurrences, 3) * 0.5;
        }
    }
    return score;
}
/**
 * Selects the most relevant chunks for a given task.
 * @param {string[]} chunks
 * @param {string} task
 * @param {number} maxChunks
 * @returns {string[]}
 */
export function selectRelevantChunks(chunks, task, maxChunks = 2) {
    return chunks
        .map((chunk, index) => ({
        chunk,
        index,
        score: scoreChunk(chunk, task)
    }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxChunks)
        .sort((a, b) => a.index - b.index) // Restore original order
        .map(x => x.chunk);
}
/**
 * Combines selected chunks into a single context string.
 * @param {string[]} chunks
 * @returns {string}
 */
export function buildContextWindow(chunks) {
    return chunks.join("\n\n... [CHUNK BOUNDARY] ...\n\n");
}
