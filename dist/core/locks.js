/**
 * Simple in-memory file locking system to prevent race conditions
 * during parallel execution.
 */
const lockedFiles = new Set();
/**
 * Attempts to acquire a lock for a file.
 * @param {string} filePath
 * @returns {boolean} - True if lock acquired, false if already locked.
 */
export function acquireLock(filePath) {
    if (lockedFiles.has(filePath)) {
        return false;
    }
    lockedFiles.add(filePath);
    return true;
}
/**
 * Releases a lock for a file.
 * @param {string} filePath
 */
export function releaseLock(filePath) {
    lockedFiles.delete(filePath);
}
/**
 * Checks if a file is currently locked.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isLocked(filePath) {
    return lockedFiles.has(filePath);
}
/**
 * Clears all locks. Useful for cleanup.
 */
export function clearAllLocks() {
    lockedFiles.clear();
}
