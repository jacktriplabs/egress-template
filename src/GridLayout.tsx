import * as React from 'react';

import {
  UseParticipantsOptions,
  useGridLayout,
  usePagination,
  useSwipe,
  TrackLoop,
  GridLayoutDefinition,
} from '@livekit/components-react';
import { mergeProps } from './mergeProps';
import { PaginationControl } from './PaginationControl';
import { PaginationIndicator } from './PaginationIndicator';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';

/** @public */
export interface GridLayoutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    Pick<UseParticipantsOptions, 'updateOnlyOn'> {
  children: React.ReactNode;
  tracks: TrackReferenceOrPlaceholder[];
}


export const JKTP_GRID_LAYOUTS: GridLayoutDefinition[] = [
  {
    columns: 1,
    rows: 1,
  },
  {
    columns: 1,
    rows: 2,
    orientation: 'portrait',
  },
  {
    columns: 2,
    rows: 1,
    orientation: 'landscape',
  },
  {
    columns: 2,
    rows: 2,
    minWidth: 560,
  },
  {
    columns: 3,
    rows: 3,
    minWidth: 700,
  },
  {
    columns: 4,
    rows: 4,
    minWidth: 960,
  },
  {
    columns: 5,
    rows: 5,
    minWidth: 1100,
  },
  {
    columns: 6,
    rows: 6,
    minWidth: 1200,
  },
] as const;

/**
 * The `GridLayout` component displays the nested participants in a grid where every participants has the same size.
 * It also supports pagination if there are more participants than the grid can display.
 * @remarks
 * To ensure visual stability when tiles are reordered due to track updates,
 * the component uses the `useVisualStableUpdate` hook.
 * @example
 * ```tsx
 * <LiveKitRoom>
 *   <GridLayout tracks={tracks}>
 *     <ParticipantTile />
 *   </GridLayout>
 * <LiveKitRoom>
 * ```
 * @public
 */
export function GridLayout({ tracks, ...props }: GridLayoutProps) {
  const gridEl = React.createRef<HTMLDivElement>();

  const elementProps = React.useMemo(
    () => mergeProps(props, { className: 'lk-grid-layout' }),
    [props],
  );
  const { layout } = useGridLayout(gridEl, tracks.length, { gridLayouts: JKTP_GRID_LAYOUTS });
  console.log(layout);
  const pagination = usePagination(layout.maxTiles, tracks);

  useSwipe(gridEl, {
    onLeftSwipe: pagination.nextPage,
    onRightSwipe: pagination.prevPage,
  });

  return (
    <div ref={gridEl} data-lk-pagination={pagination.totalPageCount > 1} {...elementProps}>
      <TrackLoop tracks={pagination.tracks}>{props.children}</TrackLoop>
      {tracks.length > layout.maxTiles && (
        <>
          <PaginationIndicator
            totalPageCount={pagination.totalPageCount}
            currentPage={pagination.currentPage}
          />
          <PaginationControl pagesContainer={gridEl} {...pagination} />
        </>
      )}
    </div>
  );
}