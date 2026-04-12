/**
 * Groups steps into execution batches based on dependencies.
 * Steps in the same batch can run in parallel.
 *
 * @param {Array} steps - Array of step objects { id, dependsOn, ... }
 * @returns {Array<Array>} - Array of batches, each batch is an array of steps
 */
export function buildExecutionBatches(steps) {
    if (!steps || steps.length === 0)
        return [];
    const batches = [];
    const completed = new Set();
    const remaining = [...steps];
    while (remaining.length > 0) {
        const currentBatch = [];
        for (let i = 0; i < remaining.length; i++) {
            const step = remaining[i];
            // A step can run if all its dependencies are in the 'completed' set
            const canRun = (step.dependsOn || []).every(depId => completed.has(depId));
            if (canRun) {
                currentBatch.push(step);
            }
        }
        if (currentBatch.length === 0) {
            // Avoid infinite loop if there are circular dependencies or missing IDs
            // Move all remaining to sequential batches as a safety fallback
            remaining.forEach(s => batches.push([s]));
            break;
        }
        batches.push(currentBatch);
        currentBatch.forEach(s => {
            completed.add(s.id);
            const idx = remaining.indexOf(s);
            if (idx > -1)
                remaining.splice(idx, 1);
        });
    }
    return batches;
}
