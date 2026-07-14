import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackType } from '../types';
import { resetTrackGlobalConfig, setTrackGlobalConfig } from '../track/config';
import {
    BATCH_TRACK_QUEUE,
    DestroyBatchTracker,
    InitBatchTracker,
    processBatchQueue,
} from '../track/core/sendBatchTrack';
import { sendTrack } from '../track/core/sendTrack';

const setVisibilityState = (value: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', {
        value,
        configurable: true,
    });
};

describe('sendTrack', () => {
    beforeEach(() => {
        resetTrackGlobalConfig();
        BATCH_TRACK_QUEUE.length = 0;
        setVisibilityState('visible');
    });

    afterEach(() => {
        DestroyBatchTracker();
        BATCH_TRACK_QUEUE.length = 0;
    });

    it('does not send when tracking is disabled', async () => {
        setTrackGlobalConfig({ trackUrl: '/track', enable: false, enableBatch: false });

        await sendTrack({ eventName: 'disabled', type: TrackType.CUSTOM }, {});

        expect(fetch).not.toHaveBeenCalled();
    });

    it('does not send without eventName', async () => {
        setTrackGlobalConfig({ trackUrl: '/track', enableBatch: false });

        await sendTrack({ eventName: '', type: TrackType.CUSTOM }, {});

        expect(fetch).not.toHaveBeenCalled();
    });

    it('sends a single track request when batch is disabled', async () => {
        setTrackGlobalConfig({ trackUrl: '/track', enable: true, enableBatch: false });

        await sendTrack({ eventName: 'single', type: TrackType.CUSTOM }, { enableBatch: false });

        expect(fetch).toHaveBeenCalledWith('/track', expect.objectContaining({
            method: 'POST',
            keepalive: true,
        }));
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({ eventName: 'single', type: TrackType.CUSTOM });
        expect(body.timestamp).toEqual(expect.any(Number));
    });

    it('stores failed single track requests in localStorage', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));
        setTrackGlobalConfig({ trackUrl: '/track', enable: true, enableBatch: false });

        await sendTrack({ eventName: 'failed', type: TrackType.CUSTOM }, { enableBatch: false });

        const failedTracks = JSON.parse(localStorage.getItem('failedTracks') || '[]');
        expect(failedTracks).toHaveLength(1);
        expect(failedTracks[0]).toMatchObject({
            eventName: 'failed',
            type: TrackType.CUSTOM,
            retryCount: 0,
        });
    });

    it('queues tracks when batch is enabled', async () => {
        setTrackGlobalConfig({
            trackUrl: '/track',
            batchTrackUrl: '/batch-track',
            enable: true,
            enableBatch: true,
            batchConfig: { batchSize: 10, batchInterval: 5000 },
        });

        await sendTrack({ eventName: 'queued', type: TrackType.CLICK }, {});

        expect(BATCH_TRACK_QUEUE).toHaveLength(1);
        expect(BATCH_TRACK_QUEUE[0]).toMatchObject({ eventName: 'queued', type: TrackType.CLICK });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('uses hook trackUrl over global trackUrl for single requests', async () => {
        setTrackGlobalConfig({ trackUrl: '/global-track', enable: true, enableBatch: false });

        await sendTrack(
            { eventName: 'override_url', type: TrackType.CUSTOM },
            { trackUrl: '/hook-track', enableBatch: false }
        );

        expect(fetch).toHaveBeenCalledWith('/hook-track', expect.any(Object));
    });

    it('flushes batch queue when batchSize is reached', async () => {
        setTrackGlobalConfig({
            trackUrl: '/track',
            batchTrackUrl: '/batch-track',
            enable: true,
            enableBatch: true,
            batchConfig: { batchSize: 2, batchInterval: 5000 },
        });

        await sendTrack({ eventName: 'batch_1', type: TrackType.CLICK }, {});
        await sendTrack({ eventName: 'batch_2', type: TrackType.CLICK }, {});

        expect(fetch).toHaveBeenCalledWith('/batch-track', expect.objectContaining({ method: 'POST' }));
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body.tracks).toHaveLength(2);
        expect(BATCH_TRACK_QUEUE).toHaveLength(0);
    });

    it('flushes batch queue by batchInterval', async () => {
        vi.useFakeTimers();
        setTrackGlobalConfig({
            trackUrl: '/track',
            batchTrackUrl: '/batch-track',
            enable: true,
            enableBatch: true,
            batchConfig: { batchSize: 10, batchInterval: 1000 },
        });

        await sendTrack({ eventName: 'interval_batch', type: TrackType.CLICK }, {});
        expect(fetch).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1000);

        expect(fetch).toHaveBeenCalledWith('/batch-track', expect.objectContaining({ method: 'POST' }));
        expect(BATCH_TRACK_QUEUE).toHaveLength(0);
    });

    it('stores tracks in failed queue when batch upload fails', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));
        setTrackGlobalConfig({
            trackUrl: '/track',
            batchTrackUrl: '/batch-track',
            enable: true,
            enableBatch: true,
            batchConfig: { batchSize: 10, batchInterval: 5000 },
        });
        BATCH_TRACK_QUEUE.push({ eventName: 'failed_batch', type: TrackType.CLICK });

        await processBatchQueue({});

        const failedTracks = JSON.parse(localStorage.getItem('failedTracks') || '[]');
        expect(failedTracks).toHaveLength(1);
        expect(failedTracks[0]).toMatchObject({
            eventName: 'failed_batch',
            type: TrackType.CLICK,
            retryCount: 0,
        });
    });

    it('flushes batch queue when page becomes hidden', async () => {
        setTrackGlobalConfig({
            trackUrl: '/track',
            batchTrackUrl: '/batch-track',
            enable: true,
            enableBatch: true,
            batchConfig: { batchSize: 10, batchInterval: 5000 },
        });
        InitBatchTracker({});
        BATCH_TRACK_QUEUE.push({ eventName: 'hidden_batch', type: TrackType.CLICK });

        setVisibilityState('hidden');
        document.dispatchEvent(new Event('visibilitychange'));

        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/batch-track', expect.any(Object)));
        expect(BATCH_TRACK_QUEUE).toHaveLength(0);
    });

    it('does not flush on hidden after DestroyBatchTracker removes listener', async () => {
        setTrackGlobalConfig({
            trackUrl: '/track',
            batchTrackUrl: '/batch-track',
            enable: true,
            enableBatch: true,
            batchConfig: { batchSize: 10, batchInterval: 5000 },
        });
        InitBatchTracker({});
        DestroyBatchTracker();
        BATCH_TRACK_QUEUE.push({ eventName: 'destroyed_listener', type: TrackType.CLICK });

        setVisibilityState('hidden');
        document.dispatchEvent(new Event('visibilitychange'));

        await Promise.resolve();
        expect(fetch).not.toHaveBeenCalled();
        expect(BATCH_TRACK_QUEUE).toHaveLength(1);
    });
});
