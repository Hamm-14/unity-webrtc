// import useScript from "../hooks/useScript";
import "./css/Receiver.css";
// import Receiver from "../scripts/receiver.js";
import { useEffect, useState, useRef } from "react";
import { getServerConfig, getRTCConfiguration } from "../scripts/config.js";
import { createDisplayStringArray } from "../scripts/stats.js";
import { VideoPlayer } from "../scripts/videoplayer.js";
import { RenderStreaming } from "../scripts/renderstreaming.js";
import { Signaling, WebSocketSignaling } from "../scripts/signaling.js";
import playButtonImage from "../static/images/Play.png";

const Reciever = () => {
  const [isPlayButtonVisible, setIsPlayButtonVisible] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [message, setMessage] = useState(false);
  const [codecList, setCodecList] = useState([]);
  let renderstreaming = useRef(null);
  let useWebSocket = useRef(null);
  let codecPreferencesDiv = useRef(null);
  let supportsSetCodecPreferences = useRef(null);
  // let messageDiv = useRef(null);
  let playerDiv = useRef(null);
  let lockMouseCheckDiv = useRef(null);
  let videoPlayer = useRef(null);
  // let videoPlayer;
  let lastStats = useRef(null);
  let intervalId = useRef(null);

  // useScript(
  //   "https://webrtc.github.io/adapter/adapter-latest.js",
  //   "text/javascript"
  // );
  // useScript("https://unpkg.com/event-target@latest/min.js", null);
  // useScript(
  //   "https://unpkg.com/resize-observer-polyfill@1.5.0/dist/ResizeObserver.global.js",
  //   null
  // );
  // useScript(
  //   "https://cdn.polyfill.io/v2/polyfill.min.js?features=IntersectionObserver",
  //   null
  // );
  // useScript("../scripts/receiver.js", "text/javascript");

  useEffect(() => {
    // window.document.oncontextmenu = function () {
    //   return false; // cancel default menu
    // };

    window.addEventListener("resize", resize, true);

    window.addEventListener("beforeunload", beforeUnload, true);

    initializeReceiver();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  const resize = () => {
    videoPlayer.current.resizeVideo();
  };

  const beforeUnload = async () => {
    if (!renderstreaming.current) return;
    await renderstreaming.current.stop();
  };

  const initializeReceiver = () => {
    // codecPreferences = document.getElementById("codecPreferences");
    supportsSetCodecPreferences.current =
      window.RTCRtpTransceiver &&
      "setCodecPreferences" in window.RTCRtpTransceiver.prototype;
    // messageDiv = document.getElementById("message");
    // console.log("message Div", messageDiv);
    // messageDiv.current.style.display = "none";

    // playerDiv = document.getElementById("player");
    // lockMouseCheck = document.getElementById("lockMouseCheck");
    videoPlayer.current = new VideoPlayer();

    setup();
  };

  async function setup() {
    const res = await getServerConfig();
    useWebSocket.current = res.useWebSocket;
    showWarningIfNeeded(res.startupMode);
    showCodecSelect();
    showPlayButton();
  }

  function showWarningIfNeeded(startupMode) {
    // const warningDiv = document.getElementById("warning");
    if (startupMode === "private") {
      // warningDiv.innerHTML =
      //   "<h4>Warning</h4> This sample is not working on Private Mode.";
      // warningDiv.hidden = false;
      setShowWarning(true);
    }
  }

  function showPlayButton() {
    if (!document.getElementById("playButton")) {
      setIsPlayButtonVisible(true);
      // const elementPlayButton = document.createElement('img');
      // elementPlayButton.id = 'playButton';
      // elementPlayButton.src = playButtonImage;
      // elementPlayButton.alt = 'Start Streaming';
      // playButton = document.getElementById('player').appendChild(elementPlayButton);
      // playButton.addEventListener('click', onClickPlayButton);
    }
  }

  function onClickPlayButton() {
    setIsPlayButtonVisible(false);
    // playButton.style.display = 'none';
    // add video player
    videoPlayer.current.createPlayer(
      playerDiv.current,
      lockMouseCheckDiv.current
    );
    setupRenderStreaming();
  }

  async function setupRenderStreaming() {
    codecPreferencesDiv.current.disabled = true;

    const signaling = useWebSocket.current
      ? new WebSocketSignaling()
      : new Signaling();
    const config = getRTCConfiguration();
    renderstreaming.current = new RenderStreaming(signaling, config);
    renderstreaming.current.onConnect = onConnect;
    renderstreaming.current.onDisconnect = onDisconnect;
    renderstreaming.current.onTrackEvent = (data) =>
      videoPlayer.current.addTrack(data.track);
    renderstreaming.current.onGotOffer = setCodecPreferences;

    await renderstreaming.current.start();
    await renderstreaming.current.createConnection();
  }

  function onConnect() {
    const channel = renderstreaming.current.createDataChannel("input");
    videoPlayer.current.setupInput(channel);
    showStatsMessage();
  }

  async function onDisconnect(connectionId) {
    clearStatsMessage();
    // messageDiv.current.style.display = "block";
    // messageDiv.current.innerText = `Disconnect peer on ${connectionId}.`;
    setMessage(`Disconnect peer on ${connectionId}.`);

    await renderstreaming.current.stop();
    renderstreaming.current = null;
    videoPlayer.current.deletePlayer();
    if (supportsSetCodecPreferences.current) {
      codecPreferencesDiv.current.disabled = false;
    }
    showPlayButton();
  }

  function setCodecPreferences() {
    let selectedCodecs = null;
    if (supportsSetCodecPreferences.current) {
      const preferredCodec =
        codecPreferencesDiv.current.options[
          codecPreferencesDiv.current.selectedIndex
        ];
      if (preferredCodec.value !== "") {
        const [mimeType, sdpFmtpLine] = preferredCodec.value.split(" ");
        const { codecs } = RTCRtpSender.getCapabilities("video");
        const selectedCodecIndex = codecs.findIndex(
          (c) => c.mimeType === mimeType && c.sdpFmtpLine === sdpFmtpLine
        );
        const selectCodec = codecs[selectedCodecIndex];
        selectedCodecs = [selectCodec];
      }
    }

    if (selectedCodecs == null) {
      return;
    }
    const transceivers = renderstreaming.current
      .getTransceivers()
      .filter((t) => t.receiver.track.kind === "video");
    if (transceivers && transceivers.length > 0) {
      transceivers.forEach((t) => t.setCodecPreferences(selectedCodecs));
    }
  }

  function showCodecSelect() {
    if (!supportsSetCodecPreferences.current) {
      // messageDiv.current.style.display = "block";
      // messageDiv.current.innerHTML = `Current Browser does not support <a href="https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/setCodecPreferences">RTCRtpTransceiver.setCodecPreferences</a>.`;
      setMessage(
        `Current Browser does not support <a href="https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/setCodecPreferences">RTCRtpTransceiver.setCodecPreferences</a>.`
      );
      return;
    }

    const codecs = RTCRtpSender.getCapabilities("video").codecs;
    let codecOptionsList = [];
    codecs.forEach((codec) => {
      if (["video/red", "video/ulpfec", "video/rtx"].includes(codec.mimeType)) {
        return;
      }
      // const option = document.createElement("option");
      codecOptionsList.push(
        (codec.mimeType + " " + (codec.sdpFmtpLine || "")).trim()
      );
      // option.value = (codec.mimeType + " " + (codec.sdpFmtpLine || "")).trim();
      // option.innerText = option.value;
      // codecPreferencesDiv.current.appendChild(option);
    });
    codecPreferencesDiv.current.disabled = false;
    setCodecList(codecOptionsList);
  }

  // function showStatsMessage() {
  //   console.log("show stats message triggered");
  // }

  // function clearStatsMessage() {
  //   console.log("clear stats message triggered");
  // }

  function showStatsMessage() {
    intervalId.current = setInterval(async () => {
      if (renderstreaming.current == null) {
        return;
      }

      const stats = await renderstreaming.current.getStats();
      if (stats == null) {
        return;
      }

      const array = createDisplayStringArray(stats, lastStats.current);
      if (array.length) {
        // messageDiv.current.style.display = "block";
        // messageDiv.current.innerHTML = array.join("<br>");
        let messages = array.join("<br>");
        setMessage(messages);
      }
      lastStats.current = stats;
    }, 1000);
  }

  function clearStatsMessage() {
    if (intervalId.current) {
      clearInterval(intervalId.current);
    }
    lastStats.current = null;
    intervalId.current = null;
    setMessage(null);
    // messageDiv.current.style.display = "none";
    // messageDiv.current.innerHTML = "";
  }

  console.log("rerendering...");
  return (
    <div id="container">
      <h1>Receiver Sample</h1>

      {showWarning && (
        <div id="warning">
          <h4>Warning</h4> This sample is not working on Private Mode.
        </div>
      )}

      <div ref={playerDiv} id="player">
        {isPlayButtonVisible && (
          <img
            src={playButtonImage}
            alt="Start Streaming"
            id="playButton"
            onClick={onClickPlayButton}
          />
        )}
      </div>

      <div className="box">
        <span>Codec preferences:</span>
        <select
          ref={codecPreferencesDiv}
          id="codecPreferences"
          autoComplete="off"
          disabled
        >
          <option value="">Default</option>
          {codecList?.map((codec, index) => (
            <option value={codec} key={index}>
              {codec}
            </option>
          ))}
        </select>
      </div>

      <div className="box">
        <span>Lock Cursor to Player:</span>
        <input
          ref={lockMouseCheckDiv}
          type="checkbox"
          id="lockMouseCheck"
          autoComplete="off"
        />
      </div>

      {message && <div id="message">{message}</div>}
    </div>
  );
};

export default Reciever;
