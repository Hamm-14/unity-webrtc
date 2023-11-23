import useScript from "../hooks/useScript";
import "./css/Receiver.css";
// import Receiver from "../scripts/receiver.js";
import { useEffect } from "react";
import { getServerConfig, getRTCConfiguration } from "../scripts/config.js";
import { createDisplayStringArray } from "../scripts/stats.js";
import { VideoPlayer } from "../scripts/videoplayer.js";
import { RenderStreaming } from "../scripts/renderstreaming.js";
import { Signaling, WebSocketSignaling } from "../scripts/signaling.js";

const Reciever = () => {
  let playButton;
  let renderstreaming;
  let useWebSocket;
  let codecPreferences;
  let supportsSetCodecPreferences;
  let messageDiv;
  let playerDiv;
  let lockMouseCheck;
  let videoPlayer;
  let lastStats;
  let intervalId;

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
    window.document.oncontextmenu = function () {
      return false; // cancel default menu
    };

    window.addEventListener(
      "resize",
      function () {
        videoPlayer.resizeVideo();
      },
      true
    );

    window.addEventListener(
      "beforeunload",
      async () => {
        if (!renderstreaming) return;
        await renderstreaming.stop();
      },
      true
    );

    initializeReceiver();
  }, []);

  const initializeReceiver = () => {
    codecPreferences = document.getElementById("codecPreferences");
    supportsSetCodecPreferences =
      window.RTCRtpTransceiver &&
      "setCodecPreferences" in window.RTCRtpTransceiver.prototype;
    messageDiv = document.getElementById("message");
    // console.log("message Div", messageDiv);
    messageDiv.style.display = "none";

    playerDiv = document.getElementById("player");
    lockMouseCheck = document.getElementById("lockMouseCheck");
    videoPlayer = new VideoPlayer();

    setup();
  };

  async function setup() {
    const res = await getServerConfig();
    useWebSocket = res.useWebSocket;
    showWarningIfNeeded(res.startupMode);
    showCodecSelect();
    showPlayButton();
  }

  function showWarningIfNeeded(startupMode) {
    const warningDiv = document.getElementById("warning");
    if (startupMode == "private") {
      warningDiv.innerHTML =
        "<h4>Warning</h4> This sample is not working on Private Mode.";
      warningDiv.hidden = false;
    }
  }

  function showPlayButton() {
    if (!document.getElementById("playButton")) {
      const elementPlayButton = document.createElement("img");
      elementPlayButton.id = "playButton";
      elementPlayButton.src = "../../images/Play.png";
      elementPlayButton.alt = "Start Streaming";
      playButton = document
        .getElementById("player")
        .appendChild(elementPlayButton);
      playButton.addEventListener("click", onClickPlayButton);
    }
  }

  function onClickPlayButton() {
    playButton.style.display = "none";

    // add video player
    videoPlayer.createPlayer(playerDiv, lockMouseCheck);
    setupRenderStreaming();
  }

  async function setupRenderStreaming() {
    codecPreferences.disabled = true;

    const signaling = useWebSocket ? new WebSocketSignaling() : new Signaling();
    const config = getRTCConfiguration();
    renderstreaming = new RenderStreaming(signaling, config);
    renderstreaming.onConnect = onConnect;
    renderstreaming.onDisconnect = onDisconnect;
    renderstreaming.onTrackEvent = (data) => videoPlayer.addTrack(data.track);
    renderstreaming.onGotOffer = setCodecPreferences;

    await renderstreaming.start();
    await renderstreaming.createConnection();
  }

  function onConnect() {
    const channel = renderstreaming.createDataChannel("input");
    videoPlayer.setupInput(channel);
    showStatsMessage();
  }

  async function onDisconnect(connectionId) {
    clearStatsMessage();
    messageDiv.style.display = "block";
    messageDiv.innerText = `Disconnect peer on ${connectionId}.`;

    await renderstreaming.stop();
    renderstreaming = null;
    videoPlayer.deletePlayer();
    if (supportsSetCodecPreferences) {
      codecPreferences.disabled = false;
    }
    showPlayButton();
  }

  function setCodecPreferences() {
    /** @type {RTCRtpCodecCapability[] | null} */
    let selectedCodecs = null;
    if (supportsSetCodecPreferences) {
      const preferredCodec =
        codecPreferences.options[codecPreferences.selectedIndex];
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
    const transceivers = renderstreaming
      .getTransceivers()
      .filter((t) => t.receiver.track.kind == "video");
    if (transceivers && transceivers.length > 0) {
      transceivers.forEach((t) => t.setCodecPreferences(selectedCodecs));
    }
  }

  function showCodecSelect() {
    if (!supportsSetCodecPreferences) {
      messageDiv.style.display = "block";
      messageDiv.innerHTML = `Current Browser does not support <a href="https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpTransceiver/setCodecPreferences">RTCRtpTransceiver.setCodecPreferences</a>.`;
      return;
    }

    const codecs = RTCRtpSender.getCapabilities("video").codecs;
    codecs.forEach((codec) => {
      if (["video/red", "video/ulpfec", "video/rtx"].includes(codec.mimeType)) {
        return;
      }
      const option = document.createElement("option");
      option.value = (codec.mimeType + " " + (codec.sdpFmtpLine || "")).trim();
      option.innerText = option.value;
      codecPreferences.appendChild(option);
    });
    codecPreferences.disabled = false;
  }

  // function showStatsMessage() {
  //   console.log("show stats message triggered");
  // }

  // function clearStatsMessage() {
  //   console.log("clear stats message triggered");
  // }

  function showStatsMessage() {
    intervalId = setInterval(async () => {
      if (renderstreaming == null) {
        return;
      }

      const stats = await renderstreaming.getStats();
      if (stats == null) {
        return;
      }

      const array = createDisplayStringArray(stats, lastStats);
      if (array.length) {
        messageDiv.style.display = 'block';
        messageDiv.innerHTML = array.join('<br>');
      }
      lastStats = stats;
    }, 1000);
  }

  function clearStatsMessage() {
    if (intervalId) {
      clearInterval(intervalId);
    }
    lastStats = null;
    intervalId = null;
    messageDiv.style.display = 'none';
    messageDiv.innerHTML = '';
  }

  return (
    <div id="container">
      <h1>Receiver Sample</h1>

      <div id="warning" hidden={false}></div>

      <div id="player"></div>

      <div className="box">
        <span>Codec preferences:</span>
        <select id="codecPreferences" autoComplete="off" disabled>
          <option value="">Default</option>
        </select>
      </div>

      <div className="box">
        <span>Lock Cursor to Player:</span>
        <input type="checkbox" id="lockMouseCheck" autoComplete="off" />
      </div>

      <div id="message"></div>
    </div>
  );
};

export default Reciever;
