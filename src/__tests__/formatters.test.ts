import {formatTime, trackMeta} from '../utils/formatters';

describe('formatTime', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats seconds less than a minute with leading zero', () => {
    expect(formatTime(45)).toBe('0:45');
  });

  it('formats whole minutes correctly', () => {
    expect(formatTime(60)).toBe('1:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('2:05');
  });

  it('handles large values', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('returns 0:00 for non-finite values', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-Infinity)).toBe('0:00');
  });
});

describe('trackMeta', () => {
  const audioFile = {
    id: 'test-id',
    name: 'test.mp3',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    kind: 'audio' as const,
    mimeType: 'audio/mpeg',
    size: 1024000,
    sizeLabel: '1.0 MB',
    duration: 180,
    durationLabel: '3:00',
    hasArtwork: true,
    modifiedAt: '2024-01-01T00:00:00.000Z',
  };

  it('formats with artist and album', () => {
    const result = trackMeta(audioFile);
    expect(result).toBe('Test Artist - Test Album - 3:00 - 1.0 MB');
  });

  it('formats with artist only', () => {
    const fileWithoutAlbum = {...audioFile, album: undefined};
    const result = trackMeta(fileWithoutAlbum);
    expect(result).toBe('Test Artist - 3:00 - 1.0 MB');
  });

  it('formats video with type', () => {
    const videoFile = {...audioFile, kind: 'video' as const, artist: undefined, album: undefined};
    const result = trackMeta(videoFile);
    expect(result).toBe('Video - 3:00 - 1.0 MB');
  });

  it('handles missing duration', () => {
    const fileWithoutDuration = {...audioFile, durationLabel: undefined};
    const result = trackMeta(fileWithoutDuration);
    expect(result).toBe('Test Artist - Test Album - 1.0 MB');
  });

  it('trims whitespace from artist and album', () => {
    const fileWithWhitespace = {...audioFile, artist: '  Test Artist  ', album: '  Test Album  '};
    const result = trackMeta(fileWithWhitespace);
    expect(result).toBe('Test Artist - Test Album - 3:00 - 1.0 MB');
  });
});