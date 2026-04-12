import path from "path";
export function safePath(projectRoot, targetPath) {
    const resolved = path.resolve(projectRoot, targetPath);
    if (!resolved.startsWith(projectRoot)) {
        throw new Error("Path escape detected");
    }
    return resolved;
}
