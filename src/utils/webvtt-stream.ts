export interface WebVttCueData {
  startTime: number;
  endTime: number;
  text: string;
}

export function parseWebVttTimestamp(value: string): number {
  const parts = value.trim().split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part)) || (parts.length !== 2 && parts.length !== 3)) return NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function parseCueBlock(block: string): WebVttCueData | null {
  const lines = block.split('\n');
  const timingIndex = lines.findIndex((line) => line.includes('-->'));
  if (timingIndex === -1) return null;
  const [rawStart, rawEnd] = lines[timingIndex].split('-->');
  const startTime = parseWebVttTimestamp(rawStart);
  const endTime = parseWebVttTimestamp((rawEnd || '').trim().split(/\s+/)[0]);
  const text = lines.slice(timingIndex + 1).join('\n').trim();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime || !text) return null;
  return { startTime, endTime, text };
}

export class StreamingWebVttParser {
  private buffer = '';

  push(chunk: string): WebVttCueData[] {
    this.buffer += chunk.replace(/\r\n?/g, '\n');
    const blocks = this.buffer.split(/\n{2,}/);
    this.buffer = blocks.pop() || '';
    return blocks
      .map(parseCueBlock)
      .filter((cue): cue is WebVttCueData => cue !== null);
  }

  flush(): WebVttCueData[] {
    const finalBlock = this.buffer;
    this.buffer = '';
    const cue = parseCueBlock(finalBlock);
    return cue ? [cue] : [];
  }
}

export async function streamWebVttCues(
  url: string,
  signal: AbortSignal,
  onCue: (cue: WebVttCueData) => void,
): Promise<void> {
  const response = await fetch(url, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Subtitle request failed (${response.status})`);
  const parser = new StreamingWebVttParser();
  if (!response.body) {
    for (const cue of parser.push(await response.text())) onCue(cue);
    for (const cue of parser.flush()) onCue(cue);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const cue of parser.push(decoder.decode(value, { stream: true }))) onCue(cue);
  }
  for (const cue of parser.push(decoder.decode())) onCue(cue);
  for (const cue of parser.flush()) onCue(cue);
}
