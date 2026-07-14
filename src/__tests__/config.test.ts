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
});
