/**
 * Aligns parsed diff lines into side-by-side columns.
 */
export function alignDiff(parsed) {
  const left = [];
  const right = [];

  let i = 0;
  while (i < parsed.length) {
    const line = parsed[i];

    if (line.type === "same") {
      left.push(line.value);
      right.push(line.value);
      i++;
    } else if (line.type === "remove") {
      // Look ahead for a matching "add" to align as a "change"
      if (parsed[i + 1] && parsed[i + 1].type === "add") {
        left.push(line.value);
        right.push(parsed[i + 1].value);
        i += 2;
      } else {
        left.push(line.value);
        right.push("");
        i++;
      }
    } else if (line.type === "add") {
      left.push("");
      right.push(line.value);
      i++;
    }
  }

  return { left, right };
}
