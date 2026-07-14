import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FailedTrackParams, TrackType } from '../types';
import { resetTrackGlobalConfig, setTrackGlobalConfig } from '../track/config';
import { getFailedTracks, retryFailedTracks, saveFailedTracks } from '../track/core/retryTrack';

const createFailedTrack = (overrides: Partial<FailedTrackParams> = {}): FailedTrackParams => ({
    id: 'track_1',
    eventName: 'retry_event',
    type: TrackType.CUSTOM,
    retryTime: Date.now() - 10000,
    retryCount: 0,
    ...overrides,
});

describe('retryTrack', () => {
    beforeEach(() => {
        resetTrackGlobalConfig();
    });

    it('retries failed tracks immediately when forced', async () => {
        setTrackGlobalConfig({ trackUrl: '/track', enableBatch: false });
        saveFailedTracks([createFailedTrack()]);

        await retryFailedTracks(true);

        expect(fetch).toHaveBeenCalledWith('/track', expect.objectContaining({ method: 'POST' }));
        expect(getFailedTracks()).toHaveLength(0);
    });

    it('removes expired failed tracks', async () => {
        setTrackGlobalConfig({
            trackUrl: '/track',
            enableBatch: false,
            retryConfig: { maxRetryTimes: 3, initialDelay: 1000, delayMultiplier: 2 },
        });
        saveFailedTracks([createFailedTrack({ retryCount: 3 })]);

        await retryFailedTracks(true);

        expect(fetch).not.toHaveBeenCalled();
        expect(getFailedTracks()).toHaveLength(0);
    });

    it('uses batchTrackUrl in batch retry mode', async () => {
        setTrackGlobalConfig({
            trackUrl: '/track',
            batchTrackUrl: '/batch-track',
            enableBatch: true,
        });
        saveFailedTracks([createFailedTrack()]);

        await retryFailedTracks(true);

        expect(fetch).toHaveBeenCalledWith('/batch-track', expect.objectContaining({ method: 'POST' }));
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body.tracks).toHaveLength(1);
        expect(getFailedTracks()).toHaveLength(0);
    });

    it('updates retry metadata when retry fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));
        setTrackGlobalConfig({ trackUrl: '/track', enableBatch: false });
        saveFailedTracks([createFailedTrack()]);

        await retryFailedTracks(true);

        const failedTracks = getFailedTracks();
        expect(failedTracks).toHaveLength(1);
        expect(failedTracks[0].retryCount).toBe(1);
    });

    it('does not retry before exponential backoff delay', async () => {
        const now = Date.now();
        setTrackGlobalConfig({
            trackUrl: '/track',
            enableBatch: false,
            retryConfig: { maxRetryTimes: 3, initialDelay: 1000, delayMultiplier: 2 },
        });
        saveFailedTracks([createFailedTrack({ retryTime: now - 500, retryCount: 0 })]);

        await retryFailedTracks();

        expect(fetch).not.toHaveBeenCalled();
        expect(getFailedTracks()).toHaveLength(1);
    });

    it('retries after exponential backoff delay', async () => {
        const now = Date.now();
        setTrackGlobalConfig({
            trackUrl: '/track',
            enableBatch: false,
            retryConfig: { maxRetryTimes: 3, initialDelay: 1000, delayMultiplier: 2 },
        });
        saveFailedTracks([createFailedTrack({ retryTime: now - 2000, retryCount: 1 })]);

        await retryFailedTracks();

        expect(fetch).toHaveBeenCalledWith('/track', expect.objectContaining({ method: 'POST' }));
        expect(getFailedTracks()).toHaveLength(0);
    });

    it('keeps only failed tracks when single retries partially fail', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(new Response(null, { status: 200 }))
            .mockResolvedValueOnce(new Response(null, { status: 500 }));
        setTrackGlobalConfig({ trackUrl: '/track', enableBatch: false });
        saveFailedTracks([
            createFailedTrack({ id: 'success_track', eventName: 'success_retry' }),
            createFailedTrack({ id: 'failed_track', eventName: 'failed_retry' }),
        ]);

        await retryFailedTracks(true);

        const failedTracks = getFailedTracks();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(failedTracks).toHaveLength(1);
        expect(failedTracks[0]).toMatchObject({
            id: 'failed_track',
            eventName: 'failed_retry',
            retryCount: 1,
        });
    });

    it('updates retry metadata for all tracks when batch retry fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));
        setTrackGlobalConfig({
            trackUrl: '/track',
            batchTrackUrl: '/batch-track',
            enableBatch: true,
        });
        saveFailedTracks([
            createFailedTrack({ id: 'batch_1', eventName: 'batch_retry_1' }),
            createFailedTrack({ id: 'batch_2', eventName: 'batch_retry_2' }),
        ]);

        await retryFailedTracks(true);

        const failedTracks = getFailedTracks();
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(failedTracks).toHaveLength(2);
        expect(failedTracks.every(track => track.retryCount === 1)).toBe(true);
    });

    it('returns an empty array for invalid stored JSON', () => {
        localStorage.setItem('failedTracks', '{invalid-json');

        expect(getFailedTracks()).toEqual([]);
    });

    it('resets non-array stored failed tracks', () => {
        localStorage.setItem('failedTracks', JSON.stringify({ eventName: 'bad_shape' }));

        expect(getFailedTracks()).toEqual([]);
        expect(localStorage.getItem('failedTracks')).toBe('[]');
    });
});
