import { describe, expect, it } from 'vitest';
import { getTrackGlobalConfig, resetTrackGlobalConfig, setTrackGlobalConfig } from '../track/config';

describe('track config', () => {
    it('merges partial global config', () => {
        resetTrackGlobalConfig();

        const config = setTrackGlobalConfig({
            trackUrl: '/custom-track',
            enable: false,
        });

        expect(config.trackUrl).toBe('/custom-track');
        expect(config.enable).toBe(false);
        expect(config.batchTrackUrl).toBe('/api/track/batch');
    });

    it('returns a frozen snapshot', () => {
        resetTrackGlobalConfig();

        const config = getTrackGlobalConfig();

        expect(Object.isFrozen(config)).toBe(true);
    });

    it('preserves nested config fields when partially overriding', () => {
        resetTrackGlobalConfig();

        const config = setTrackGlobalConfig({
            retryConfig: { maxRetryTimes: 5 },
            pageStayConfig: { timeout: 1000 },
        });

        expect(config.retryConfig).toMatchObject({
            maxRetryTimes: 5,
            initialDelay: 1000,
            delayMultiplier: 2,
        });
        expect(config.pageStayConfig).toMatchObject({
            timeout: 1000,
            minDuration: 2000,
            maxDuration: 60 * 60 * 1000,
            checkInterval: 1000,
        });
    });
});
