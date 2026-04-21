export function normalize(content: string): string {
  // Normalize line endings to \n
  let normalized = content.replace(/\r\n/g, "\n");
  // Remove all trailing newlines
  normalized = normalized.replace(/\n+$/, "");
  // Add exactly one trailing newline, unless it was completely empty (then just \n)
  return normalized + "\n";
}

export interface File {
  path: string;
  content: string;
}

export function generateGitPatch(files: File[]): string {
  // Deterministic sorting by path
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  const diffs = sortedFiles.map((file) => {
    const normalizedContent = normalize(file.content);
    const lines = normalizedContent.split("\n");
    // Remove the last empty element from split if it exists (due to trailing newline)
    if (lines[lines.length - 1] === "") {
      lines.pop();
    }
    
    const lineCount = lines.length;
    const path = file.path;

    let diff = `diff --git a/${path} b/${path}\n`;
    diff += `new file mode 100644\n`;
    diff += `--- /dev/null\n`;
    diff += `+++ b/${path}\n`;
    diff += `@@ -0,0 +1,${lineCount} @@\n`;
    
    for (const line of lines) {
      diff += `+${line}\n`;
    }

    return diff.trimEnd(); // Remove the last newline of the file diff to handle joining correctly
  });

  return diffs.join("\n\n");
}
