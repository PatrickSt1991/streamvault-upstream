export interface PersistentVideoPlaybackState {
  paused: boolean;
  readyState: number;
  channelId?: string;
}

export function shouldStartPlayerPlayback(
  previousChannelId: string | undefined,
  currentChannelId: string,
  mobile: boolean,
  video: PersistentVideoPlaybackState | null,
): boolean {
  if (previousChannelId !== undefined && previousChannelId !== currentChannelId) return true;
  if (!mobile) return true;
  if (!video || video.channelId !== currentChannelId) return true;
  return video.paused || video.readyState === 0;
}
