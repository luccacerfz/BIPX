import { readCssBox, sameCssSize } from './css-viewport.js';

// This is the production binding used by main.js and the CPU probe. Each event
// is edge-triggered; writing the measured CSS dimensions cannot schedule a frame loop.
export function bindViewportLifecycle({
  sourceWindow,
  canvas,
  getCssSize,
  onViewportResize,
  onCssBox,
  onDprChange,
  ResizeObserverCtor = sourceWindow?.ResizeObserver ?? globalThis.ResizeObserver,
}) {
  if (!sourceWindow || !canvas) throw new TypeError('window and canvas are required');
  const visualViewport = sourceWindow.visualViewport;
  let suspended = false;
  let disposed = false;
  let dprQuery = null;
  let observer = null;

  const resize = (reason) => { if (!suspended && !disposed) onViewportResize?.(reason); };
  const onWindowResize = () => resize('window.resize');
  const onOrientationChange = () => resize('window.orientationchange');
  const onVisualResize = () => resize('visualViewport.resize');
  const onVisualScroll = () => resize('visualViewport.scroll');

  function unwatchDpr() {
    if (dprQuery?.removeEventListener) dprQuery.removeEventListener('change', handleDprChange);
    else dprQuery?.removeListener?.(handleDprChange);
    dprQuery = null;
  }

  function watchDpr() {
    unwatchDpr();
    dprQuery = sourceWindow.matchMedia?.(`(resolution: ${sourceWindow.devicePixelRatio || 1}dppx)`) ?? null;
    if (dprQuery?.addEventListener) dprQuery.addEventListener('change', handleDprChange, { once: true });
    else dprQuery?.addListener?.(handleDprChange);
  }

  function handleDprChange() {
    if (suspended || disposed) return;
    unwatchDpr();
    onDprChange?.();
    watchDpr();
  }

  function onPageHide() {
    suspended = true;
    observer?.disconnect();
    unwatchDpr();
  }

  function onPageShow(event) {
    if (!event?.persisted || disposed) return;
    suspended = false;
    observer?.observe(canvas);
    resize('window.pageshow');
    watchDpr();
  }

  sourceWindow.addEventListener('resize', onWindowResize, { passive: true });
  sourceWindow.addEventListener('orientationchange', onOrientationChange, { passive: true });
  visualViewport?.addEventListener('resize', onVisualResize, { passive: true });
  visualViewport?.addEventListener('scroll', onVisualScroll, { passive: true });
  sourceWindow.addEventListener('pagehide', onPageHide);
  sourceWindow.addEventListener('pageshow', onPageShow);

  if (typeof ResizeObserverCtor === 'function') {
    observer = new ResizeObserverCtor((entries) => {
      if (suspended || disposed) return;
      for (const entry of entries) {
        if (entry.target !== canvas) continue;
        const measured = readCssBox(entry);
        if (!measured || sameCssSize(getCssSize?.(), measured)) continue;
        onCssBox?.(measured);
      }
    });
    observer.observe(canvas);
  }
  watchDpr();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      suspended = true;
      observer?.disconnect();
      unwatchDpr();
      sourceWindow.removeEventListener('resize', onWindowResize);
      sourceWindow.removeEventListener('orientationchange', onOrientationChange);
      visualViewport?.removeEventListener('resize', onVisualResize);
      visualViewport?.removeEventListener('scroll', onVisualScroll);
      sourceWindow.removeEventListener('pagehide', onPageHide);
      sourceWindow.removeEventListener('pageshow', onPageShow);
    },
    get suspended() { return suspended; },
  };
}
