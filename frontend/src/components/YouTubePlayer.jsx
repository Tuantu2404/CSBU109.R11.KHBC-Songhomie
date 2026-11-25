import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

let youtubeApiPromise;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousCallback === 'function') previousCallback();
        resolve(window.YT);
      };

      let script = document.getElementById('youtube-iframe-api');
      if (!script) {
        script = document.createElement('script');
        script.id = 'youtube-iframe-api';
        script.src = 'https://www.youtube.com/iframe_api';
        script.onerror = reject;
        document.head.appendChild(script);
      }
    }).catch((error) => {
      youtubeApiPromise = null;
      throw error;
    });
  }
  return youtubeApiPromise;
}

const YouTubePlayer = forwardRef(function YouTubePlayer(
  { videoId, onTimeUpdate, onStateChange, className = '' },
  ref,
) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const callbacksRef = useRef({ onTimeUpdate, onStateChange });
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onTimeUpdate, onStateChange };
  }, [onTimeUpdate, onStateChange]);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    getState: () => playerRef.current?.getPlayerState(),
  }), []);

  useEffect(() => {
    let cancelled = false;
    let timeInterval;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current = new YT.Player(containerRef.current, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0 },
          events: {
            onReady: (event) => {
              callbacksRef.current.onTimeUpdate?.(event.target.getCurrentTime());
            },
            onStateChange: (event) => {
              const isPlaying = event.data === YT.PlayerState.PLAYING;
              callbacksRef.current.onStateChange?.(isPlaying);
              if (isPlaying) {
                window.clearInterval(timeInterval);
                timeInterval = window.setInterval(() => {
                  callbacksRef.current.onTimeUpdate?.(
                    playerRef.current?.getCurrentTime() || 0,
                  );
                }, 250);
              } else {
                window.clearInterval(timeInterval);
                callbacksRef.current.onTimeUpdate?.(
                  playerRef.current?.getCurrentTime() || 0,
                );
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      window.clearInterval(timeInterval);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  return (
    <div className={`aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
      {loadError ? (
        <p className="flex h-full items-center justify-center px-4 text-center text-sm text-white">
          Unable to load the YouTube player.
        </p>
      ) : (
        <div ref={containerRef} className="h-full w-full" />
      )}
    </div>
  );
});

export default YouTubePlayer;
