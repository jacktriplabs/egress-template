import { selectGridLayout } from '@livekit/components-core';
import type { GridLayout } from '@livekit/components-core/dist/helper/grid-layouts';
import * as React from 'react';
import useLatest from '@react-hook/latest';

/**
 * A React hook that fires a callback whenever ResizeObserver detects a change to its size
 * code extracted from https://github.com/jaredLunde/react-hook/blob/master/packages/resize-observer/src/index.tsx in order to not include the polyfill for resize-observer
 *
 * @internal
 */
export function useResizeObserver<T extends HTMLElement>(
  target: React.RefObject<T>,
  callback: UseResizeObserverCallback,
) {
  const resizeObserver = getResizeObserver();
  const storedCallback = useLatest(callback);

  React.useLayoutEffect(() => {
    let didUnsubscribe = false;

    const targetEl = target.current;
    if (!targetEl) return;

    function cb(entry: ResizeObserverEntry, observer: ResizeObserver) {
      if (didUnsubscribe) return;
      storedCallback.current(entry, observer);
    }

    resizeObserver?.subscribe(targetEl as HTMLElement, cb);

    return () => {
      didUnsubscribe = true;
      resizeObserver?.unsubscribe(targetEl as HTMLElement, cb);
    };
  }, [target.current, resizeObserver, storedCallback]);

  return resizeObserver?.observer;
}

function createResizeObserver() {
  let ticking = false;
  let allEntries: ResizeObserverEntry[] = [];

  const callbacks: Map<unknown, Array<UseResizeObserverCallback>> = new Map();

  if (typeof window === 'undefined') {
    return;
  }

  const observer = new ResizeObserver((entries: ResizeObserverEntry[], obs: ResizeObserver) => {
    allEntries = allEntries.concat(entries);
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const triggered = new Set<Element>();
        for (let i = 0; i < allEntries.length; i++) {
          if (triggered.has(allEntries[i].target)) continue;
          triggered.add(allEntries[i].target);
          const cbs = callbacks.get(allEntries[i].target);
          cbs?.forEach((cb) => cb(allEntries[i], obs));
        }
        allEntries = [];
        ticking = false;
      });
    }
    ticking = true;
  });

  return {
    observer,
    subscribe(target: HTMLElement, callback: UseResizeObserverCallback) {
      observer.observe(target);
      const cbs = callbacks.get(target) ?? [];
      cbs.push(callback);
      callbacks.set(target, cbs);
    },
    unsubscribe(target: HTMLElement, callback: UseResizeObserverCallback) {
      const cbs = callbacks.get(target) ?? [];
      if (cbs.length === 1) {
        observer.unobserve(target);
        callbacks.delete(target);
        return;
      }
      const cbIndex = cbs.indexOf(callback);
      if (cbIndex !== -1) cbs.splice(cbIndex, 1);
      callbacks.set(target, cbs);
    },
  };
}

let _resizeObserver: ReturnType<typeof createResizeObserver>;

const getResizeObserver = () =>
  !_resizeObserver ? (_resizeObserver = createResizeObserver()) : _resizeObserver;

export type UseResizeObserverCallback = (
  entry: ResizeObserverEntry,
  observer: ResizeObserver,
) => unknown;

export const useSize = (target: React.RefObject<HTMLDivElement>) => {
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useLayoutEffect(() => {
    if (target.current) {
      const { width, height } = target.current.getBoundingClientRect();
      setSize({ width, height });
    }
  }, [target.current]);

  const resizeCallback = React.useCallback(
    (entry: ResizeObserverEntry) => setSize(entry.contentRect),
    [],
  );
  // Where the magic happens
  useResizeObserver(target, resizeCallback);
  return size;
};

export const CUSTOM_GRID_LAYOUTS: GridLayout[] = [
  {
    columns: 1,
    rows: 1,
    name: '1x1',
    minTiles: 1,
    maxTiles: 1,
    minWidth: 0,
    minHeight: 0,
  },
  {
    columns: 1,
    rows: 2,
    name: '1x2',
    minTiles: 2,
    maxTiles: 2,
    minWidth: 0,
    minHeight: 0,
  },
  {
    columns: 2,
    rows: 1,
    name: '2x1',
    minTiles: 2,
    maxTiles: 2,
    minWidth: 800,
    minHeight: 0,
  },
  {
    columns: 3,
    rows: 1,
    name: '3x1',
    minTiles: 3,
    maxTiles: 3,
    minWidth: 540,
    minHeight: 0,
  },
  {
    columns: 2,
    rows: 2,
    name: '2x2',
    minTiles: 4,
    maxTiles: 4,
    minWidth: 560,
    minHeight: 0,
  },
  {
    columns: 3,
    rows: 2,
    name: '3x2',
    minTiles: 5,
    maxTiles: 6,
    minWidth: 700,
    minHeight: 0,
  },
  {
    columns: 4,
    rows: 2,
    name: '4x2',
    minTiles: 7,
    maxTiles: 8,
    minWidth: 700,
    minHeight: 0,
  },
  {
    columns: 3,
    rows: 3,
    name: '3x3',
    minTiles: 9,
    maxTiles: 9,
    minWidth: 700,
    minHeight: 0,
  },
  {
    columns: 4,
    rows: 3,
    name: '4x3',
    minTiles: 10,
    maxTiles: 12,
    minWidth: 960,
    minHeight: 0,
  },
  {
    columns: 5,
    rows: 3,
    name: '5x3',
    minTiles: 13,
    maxTiles: 15,
    minWidth: 960,
    minHeight: 0,
  },
  {
    columns: 4,
    rows: 4,
    name: '4x4',
    minTiles: 16,
    maxTiles: 16,
    minWidth: 960,
    minHeight: 0,
  },
  {
    columns: 5,
    rows: 4,
    name: '5x4',
    minTiles: 17,
    maxTiles: 20,
    minWidth: 1100,
    minHeight: 0,
  },
  {
    columns: 5,
    rows: 5,
    name: '5x5',
    minTiles: 21,
    maxTiles: 25,
    minWidth: 1100,
    minHeight: 0,
  },
];

/**
 * The useGridLayout hook tries to select the best layout to fit all tiles.
 * If the available screen space is not enough, it will reduce the number of maximum visible
 * tiles and select a layout that still works visually within the given limitations.
 * As the order of tiles changes over time, the hook tries to keep visual updates to a minimum
 * while trying to display important tiles such as speaking participants or screen shares.
 * @public
 */
export function useGridLayout(
  /** HTML element that contains the grid. */
  gridElement: React.RefObject<HTMLDivElement>,
  /** Count of tracks that should get layed out */
  trackCount: number,
): { layout: GridLayout } {
  const { width, height } = useSize(gridElement);

  console.log(width, height, trackCount);

  const layout =
    width > 0 && height > 0
      ? selectGridLayout(CUSTOM_GRID_LAYOUTS, trackCount, width, height)
      : CUSTOM_GRID_LAYOUTS[0];

  React.useEffect(() => {
    if (gridElement.current && layout) {
      gridElement.current.style.setProperty('--lk-col-count', layout?.columns.toString());
      gridElement.current.style.setProperty('--lk-row-count', layout?.rows.toString());
    }
  }, [gridElement, layout]);

  return {
    layout,
  };
}