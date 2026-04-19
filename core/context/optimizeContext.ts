import { isNoiseFile, isTooLarge, hasLowSignal, extractQueryTerms, boostImportant } from './noiseFilter.ts';

export interface FileSnippet {
  path: string;
  content: string;
  score?: number;
}

export function optimizeContext(files: FileSnippet[], input: string): FileSnippet[] {
  const terms = extractQueryTerms(input);

  return files
    .filter(file => {
      // 1. Noise Filter (node_modules, dist, etc)
      if (isNoiseFile(file.path)) return false;

      // 2. Size Filter (~20KB boundary)
      if (isTooLarge(file.content)) return false;

      // 3. Signal Filter (must contain at least one query term if terms exist)
      if (hasLowSignal(file.content, terms)) return false;

      return true;
    })
    .map(file => {
      // Apply existing scores or initialize
      let score = file.score || 0;

      // 4. Priority Boost
      score += boostImportant(file.path);

      return { ...file, score };
    });
}
