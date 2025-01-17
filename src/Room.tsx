import * as React from 'react';

import {
  ParticipantTile,
  LiveKitRoom,
  CarouselLayout,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  useRoomContext,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { isTrackReference, isEqualTrackRef } from '@livekit/components-core';
import { ConnectionState, Track } from 'livekit-client';

interface RoomPageProps {
  url: string;
  token: string;
  layout: string;
}

export default function RoomPage({ url, token, layout }: RoomPageProps) {
  const [error, setError] = React.useState<Error>();
  if (!url || !token) {
    return <div className="error">missing required params url and token</div>;
  }

  return (
    <LiveKitRoom serverUrl={url} token={token} onError={setError}>
      {error ? <div className="error">{error.message}</div> : <CompositeTemplate layout={layout} />}
    </LiveKitRoom>
  );
}

interface CompositeTemplateProps {
  layout: string;
}

function isUserTrack(track: TrackReferenceOrPlaceholder): boolean {
  return !!track.participant.identity &&
    track.participant.identity !== "livekit-bridge" &&
    !track.participant.identity.startsWith("egress-service");
}

interface RoomInfo {
  visibleTracks: TrackReferenceOrPlaceholder[];
  totalParticipants: number;
  videoTracks: TrackReferenceOrPlaceholder[];
  screenShareTracks: TrackReferenceOrPlaceholder[];
}

function RenderRoomInfo(tracks: TrackReferenceOrPlaceholder[]): RoomInfo {
  const filteredTracks = tracks.filter(isTrackReference).filter(isUserTrack);
  const videoTracks = filteredTracks.filter(track => track.publication.source === Track.Source.Camera && track.publication.kind === Track.Kind.Video && !track.publication.isMuted);
  const screenShareTracks = filteredTracks.filter(isTrackReference).filter(track => track.publication.source === Track.Source.ScreenShare);

  const participantTracks = [];
  const participantVideoTracks = new Map<string, TrackReferenceOrPlaceholder>();
  for (const track of filteredTracks) {
    if (track.source === Track.Source.Microphone || track.source === Track.Source.ScreenShare || track.source === Track.Source.ScreenShareAudio) {
      participantTracks.push(track);
    } else {
      if (track.publication.isMuted) {
        continue;
      }
      if (track.participant.identity) {
        if (!participantVideoTracks.has(track.participant.identity) || track.publication.trackName === "canvas") {
          participantVideoTracks.set(track.participant.identity, track);
        }
      }
    }
  }

  participantVideoTracks.forEach((tr) => {
    participantTracks.push(tr);
  });

  return {
    visibleTracks: participantTracks,
    totalParticipants: participantVideoTracks.size,
    videoTracks: videoTracks,
    screenShareTracks: screenShareTracks,
  };
}

const ASPECT_RATIO = 16 / 9;

function CompositeTemplate({ layout: initialLayout }: CompositeTemplateProps) {
  const room = useRoomContext();
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stageHeight, setStageHeight] = React.useState<string | number>(0);
  const [stageWidth, setStageWidth] = React.useState<string | number>(0);
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);
  const layoutContext = useCreateLayoutContext();
  const allTracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: true },
    ],
  );
  const { visibleTracks, screenShareTracks } = RenderRoomInfo(allTracks);
  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = visibleTracks.filter((track) => !isEqualTrackRef(track, focusTrack));

  // update stage dimensions
  const updateStageDimensions = React.useCallback(() => {
    if (!stageRef.current) {
      return;
    }
    const boundingRect = stageRef.current.getBoundingClientRect();
    const h = boundingRect.height;
    const w = boundingRect.width;
    if (w/h <= ASPECT_RATIO) {
      setStageWidth(w);
      setStageHeight("100%");
    } else {
      setStageWidth(Math.ceil(ASPECT_RATIO*(h)));
      setStageHeight(h);
    }
  }, []);

  React.useEffect(() => {
    updateStageDimensions();
    window.addEventListener("resize", updateStageDimensions);
    return () => window.removeEventListener("resize", updateStageDimensions);
  }, [updateStageDimensions]);

  React.useEffect(() => {
    // If screen share tracks are published, and no pin is set explicitly, auto set the screen share.
    if (
      screenShareTracks.some((track) => track.publication && track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication && track.publication.trackSid ===
          lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = visibleTracks.find(
        (tr) =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source,
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    screenShareTracks
      .map((ref) => `${ref?.publication?.trackSid}_${ref?.publication?.isSubscribed}`)
      .join(),
    focusTrack?.publication?.trackSid,
    visibleTracks,
  ]);

  let interfaceStyle = 'dark';
  if (initialLayout.endsWith('-light')) {
    interfaceStyle = 'light';
  }

  let containerClass = 'roomContainer';
  if (interfaceStyle) {
    containerClass += ` ${interfaceStyle}`;
  }

  if (room.state === ConnectionState.Disconnected) {
    return null;
  }

  return (
    <div className={`${containerClass}`} ref={stageRef}>
      <LayoutContextProvider value={layoutContext}>
        <div className={`lk-video-conference-inner`} style={{display: "flex", justifyContent: "center", alignItems: "center", width: stageWidth, height: stageHeight}}>
          {!focusTrack ? (
            <div className="lk-grid-layout-wrapper">
              <GridLayout tracks={visibleTracks}>
                <ParticipantTile />
              </GridLayout>
            </div>
          ) : (
            <div className={`lk-focus-layout-wrapper`} style={{width: stageWidth, height: "100%", maxHeight: stageHeight}}>
              <FocusLayoutContainer>
                <CarouselLayout tracks={carouselTracks} style={{height: "100%", maxHeight: stageHeight}}>
                  <ParticipantTile />
                </CarouselLayout>
                {focusTrack && <FocusLayout trackRef={focusTrack} />}
              </FocusLayoutContainer>
            </div>
          )}
        </div>
      </LayoutContextProvider>
    </div>
  );
}