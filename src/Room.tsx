import {
  ParticipantTile,
  LiveKitRoom,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import type { TrackReference } from '@livekit/components-core';
import EgressHelper from '@livekit/egress-sdk';
import { ConnectionState, RoomEvent, Track } from 'livekit-client';
import { ReactElement, useEffect, useState } from 'react';
import SingleSpeakerLayout from './SingleSpeakerLayout';
import SpeakerLayout from './SpeakerLayout';
import GridLayout from './GridLayout';

interface RoomPageProps {
  url: string;
  token: string;
  layout: string;
}

export default function RoomPage({ url, token, layout }: RoomPageProps) {
  const [error, setError] = useState<Error>();
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

function CompositeTemplate({ layout: initialLayout }: CompositeTemplateProps) {
  const room = useRoomContext();
  const [layout, setLayout] = useState(initialLayout);
  const [hasScreenShare, setHasScreenShare] = useState(false);
  const [displayedTracks, setDisplayedTracks] = useState<TrackReference[]>([]);
  const screenshareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
  const allTracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown],
    {
      onlySubscribed: true,
    },
  );

  useEffect(() => {
    if (room) {
      EgressHelper.setRoom(room);

      // Egress layout can change on the fly, we can react to the new layout
      // here.
      EgressHelper.onLayoutChanged((newLayout) => {
        setLayout(newLayout);
      });

      // start recording when there's already a track published
      let hasTrack = false;
      for (const p of Array.from(room.participants.values())) {
        if (p.tracks.size > 0) {
          hasTrack = true;
          break;
        }
      }

      if (hasTrack) {
        EgressHelper.startRecording();
      } else {
        room.once(RoomEvent.TrackSubscribed, () => EgressHelper.startRecording());
      }
    }
  }, [room]);

  useEffect(() => {
    if (screenshareTracks.length > 0 && screenshareTracks[0].publication) {
      setHasScreenShare(true);
    } else {
      setHasScreenShare(false);
    }
  }, [screenshareTracks]);

  useEffect(() => {
    const newTracks: TrackReference[] = [];
    const participantMap: {[key: string]: TrackReference} = {};
    allTracks.forEach(tr => {
      if (tr.publication.isMuted) {
        return;
      }
      if (tr.participant.identity === room.localParticipant.identity) {
        return;
      }
      if (tr.publication.source === Track.Source.ScreenShare) {
        newTracks.push(tr);
        return;
      }
      if (!(tr.participant.identity in participantMap)) {
        participantMap[tr.participant.identity] = tr;
      } else {
        if (tr.publication.kind === Track.Kind.Video && tr.publication.trackName === "canvas") {
          participantMap[tr.participant.identity] = tr;
        }
      }
    });

    for (const identity in participantMap) {
      newTracks.push(participantMap[identity]);
    }
    setDisplayedTracks(newTracks);
  }, [allTracks, room]);

  let interfaceStyle = 'dark';
  if (layout.endsWith('-light')) {
    interfaceStyle = 'light';
  }

  let containerClass = 'roomContainer';
  if (interfaceStyle) {
    containerClass += ` ${interfaceStyle}`;
  }

  // determine layout to use
  let main: ReactElement = <></>;
  let effectiveLayout = layout;
  if (hasScreenShare && layout.startsWith('grid')) {
    effectiveLayout = layout.replace('grid', 'speaker');
  }
  if (room.state !== ConnectionState.Disconnected) {
    if (effectiveLayout.startsWith('speaker')) {
      main = <SpeakerLayout tracks={displayedTracks} />;
    } else if (effectiveLayout.startsWith('single-speaker')) {
      main = <SingleSpeakerLayout tracks={displayedTracks} />;
    } else {
      main = (
        <GridLayout tracks={displayedTracks}>
          <ParticipantTile disableSpeakingIndicator={true} />
        </GridLayout>
      );
    }
  }

  return (
    <div className={containerClass}>
      {main}
    </div>
  );
}
