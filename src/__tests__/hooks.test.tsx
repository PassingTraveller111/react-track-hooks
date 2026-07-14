import { act, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTrackGlobalConfig, resetTrackGlobalConfig, setTrackGlobalConfig } from '../track/config';
import { DestroyBatchTracker } from '../track/core/sendBatchTrack';
import { useTrackClick } from '../track/hooks/useTrackClick';
import { useTrackCustom } from '../track/hooks/useTrackCustom';
import { useTrackExposure } from '../track/hooks/useTrackExposure';
import { useTrackFirstRender } from '../track/hooks/useTrackFirstRender';
import { useTrackInit } from '../track/hooks/useTrackInit';
import { useTrackPageStay } from '../track/hooks/useTrackPageStay';
import { MockIntersectionObserver } from './setup';

const setVisibilityState = (value: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', {
        value,
        configurable: true,
    });
};

describe('track hooks', () => {
    beforeEach(() => {
        resetTrackGlobalConfig();
        DestroyBatchTracker();
        setVisibilityState('visible');
        setTrackGlobalConfig({ trackUrl: '/track', enable: true, enableBatch: false });
    });

    it('useTrackClick sends click coordinates and extra params', async () => {
        const { result } = renderHook(() => useTrackClick('button_click', { page: 'home' }));

        act(() => {
            result.current({ clientX: 12, clientY: 34 } as React.MouseEvent, { buttonId: 'save' });
        });

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({
            eventName: 'button_click',
            page: 'home',
            buttonId: 'save',
            clientX: 12,
            clientY: 34,
        });
    });

    it('useTrackCustom returns a trigger function', async () => {
        const { result } = renderHook(() => useTrackCustom('form_submit', { formId: 'login' }));

        act(() => {
            result.current({ status: 'success' });
        });

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({
            eventName: 'form_submit',
            formId: 'login',
            status: 'success',
        });
    });

    it('useTrackFirstRender sends once on mount', async () => {
        const { rerender } = renderHook(() => useTrackFirstRender('first_render', { component: 'Card' }));

        rerender();

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({
            eventName: 'first_render',
            component: 'Card',
            trackType: 'component_first_render',
        });
    });

    it('useTrackInit sets global config even when batch is disabled', () => {
        renderHook(() => useTrackInit({
            trackUrl: '/init-track',
            enable: true,
            enableBatch: false,
        }));

        expect(getTrackGlobalConfig().trackUrl).toBe('/init-track');
        expect(getTrackGlobalConfig().enableBatch).toBe(false);
    });

    it('useTrackExposure sends when observed element intersects', async () => {
        const ExposureTarget = () => {
            const ref = useTrackExposure<HTMLDivElement>('card_exposure', { cardId: 'card_1' }, {
                exposureOnce: true,
                exposureThreshold: 0.5,
            });

            return <div ref={ref}>card</div>;
        };

        const { container } = render(<ExposureTarget />);
        const target = container.firstElementChild as Element;
        const observer = MockIntersectionObserver.instances[0];

        act(() => {
            observer.trigger([{
                isIntersecting: true,
                target,
                intersectionRatio: 0.8,
                boundingClientRect: target.getBoundingClientRect(),
            }]);
        });

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({
            eventName: 'card_exposure',
            cardId: 'card_1',
            intersectionRatio: 0.8,
        });
        expect(observer.unobserve).toHaveBeenCalledWith(target);
    });

    it('useTrackExposure can report multiple times when exposureOnce is false', async () => {
        const ExposureTarget = () => {
            const ref = useTrackExposure<HTMLDivElement>('multi_exposure', {}, {
                exposureOnce: false,
                exposureThreshold: 0.5,
            });

            return <div ref={ref}>card</div>;
        };

        const { container } = render(<ExposureTarget />);
        const target = container.firstElementChild as Element;
        const observer = MockIntersectionObserver.instances[0];

        act(() => {
            observer.trigger([{ isIntersecting: true, target, intersectionRatio: 0.8 }]);
            observer.trigger([{ isIntersecting: true, target, intersectionRatio: 0.9 }]);
        });

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(observer.unobserve).not.toHaveBeenCalledWith(target);
    });

    it('useTrackExposure does not observe when disabled', () => {
        const ExposureTarget = () => {
            const ref = useTrackExposure<HTMLDivElement>('disabled_exposure', {}, { enable: false });

            return <div ref={ref}>card</div>;
        };

        render(<ExposureTarget />);

        expect(MockIntersectionObserver.instances).toHaveLength(0);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('useTrackPageStay reports active stay time on page hidden', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        renderHook(() => useTrackPageStay('page_stay', { page: 'home' }, {
            enableBatch: false,
            pageStayConfig: {
                minDuration: 1000,
                maxDuration: 60000,
                timeout: 30000,
                checkInterval: 1000,
            },
        }));

        act(() => {
            vi.advanceTimersByTime(3000);
            window.dispatchEvent(new Event('mousedown'));
            setVisibilityState('hidden');
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await vi.runOnlyPendingTimersAsync();

        expect(fetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({
            eventName: 'page_stay',
            page: 'home',
            stayTime: 3000,
        });
    });

    it('useTrackPageStay ignores stay time below minDuration', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        renderHook(() => useTrackPageStay('page_stay_short', {}, {
            enableBatch: false,
            pageStayConfig: {
                minDuration: 1000,
                maxDuration: 60000,
                timeout: 30000,
                checkInterval: 1000,
            },
        }));

        act(() => {
            vi.advanceTimersByTime(500);
            window.dispatchEvent(new Event('mousedown'));
            setVisibilityState('hidden');
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await vi.runOnlyPendingTimersAsync();

        expect(fetch).not.toHaveBeenCalled();
    });

    it('useTrackPageStay caps stay time at maxDuration', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        renderHook(() => useTrackPageStay('page_stay_max', {}, {
            enableBatch: false,
            pageStayConfig: {
                minDuration: 1000,
                maxDuration: 5000,
                timeout: 30000,
                checkInterval: 1000,
            },
        }));

        act(() => {
            vi.advanceTimersByTime(10000);
            window.dispatchEvent(new Event('mousedown'));
            setVisibilityState('hidden');
            document.dispatchEvent(new Event('visibilitychange'));
        });

        await vi.runOnlyPendingTimersAsync();

        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({
            eventName: 'page_stay_max',
            stayTime: 5000,
        });
    });

    it('useTrackPageStay reports when user becomes inactive after timeout', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        renderHook(() => useTrackPageStay('page_stay_timeout', {}, {
            enableBatch: false,
            pageStayConfig: {
                minDuration: 500,
                maxDuration: 60000,
                timeout: 2000,
                checkInterval: 1000,
            },
        }));

        act(() => {
            vi.advanceTimersByTime(1000);
            window.dispatchEvent(new Event('mousedown'));
        });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000);
        });

        expect(fetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({
            eventName: 'page_stay_timeout',
            stayTime: 1000,
        });
    });

    it('useTrackPageStay reports on unmount', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const { unmount } = renderHook(() => useTrackPageStay('page_stay_unmount', {}, {
            enableBatch: false,
            pageStayConfig: {
                minDuration: 1000,
                maxDuration: 60000,
                timeout: 30000,
                checkInterval: 1000,
            },
        }));

        act(() => {
            vi.advanceTimersByTime(3000);
            window.dispatchEvent(new Event('mousedown'));
        });

        unmount();
        await vi.runOnlyPendingTimersAsync();

        expect(fetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
        expect(body).toMatchObject({
            eventName: 'page_stay_unmount',
            stayTime: 3000,
        });
    });
});
