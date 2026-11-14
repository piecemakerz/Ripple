// Textareas normalize line endings. Match visually, then return exact source
// slices and UTF-16 offsets; never normalize the stored source or evidence.
export function evidenceMatches(text: string, pasted: string) {
  const quote = pasted.replace(/\r\n?/g, '\n');
  if (!quote) return [];
  const offsets: number[] = [];
  let normalized = '';
  for (let i = 0; i < text.length; i++) {
    offsets.push(i);
    if (text[i] === '\r') {
      normalized += '\n';
      if (text[i + 1] === '\n') i++;
    } else normalized += text[i];
  }
  offsets.push(text.length);
  const matches: { start: number; end: number; quote: string }[] = [];
  for (let at = normalized.indexOf(quote); at !== -1; at = normalized.indexOf(quote, at + 1)) {
    const start = offsets[at],
      end = offsets[at + quote.length];
    matches.push({ start, end, quote: text.slice(start, end) });
  }
  return matches;
}
