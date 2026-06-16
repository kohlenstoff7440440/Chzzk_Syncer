(() => {
  const SMALL_STEP_SECONDS = 0.1;
  const NORMAL_STEP_SECONDS = 1.0;
  const LIVE_EDGE_MARGIN = 0.15;

  const STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON = "hideFastForwardButton";
  const STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT = "showVideoDelayInChat";

  const EVENT_FAST_FORWARD_VISIBILITY = "CHZZK_SYNCER_FAST_FORWARD_VISIBILITY";
  const EVENT_REQUEST_SETTINGS = "CHZZK_SYNCER_REQUEST_SETTINGS";

  const DEFAULT_CHAT_PLACEHOLDER = "채팅을 입력해주세요 (J)";

  let showVideoDelayInChat = false;
  let originalChatPlaceholder = null;

  // 팝업창과 채팅창이 같이 사용할 "공통 표시용 지연시간"
  let displayedDelayInfo = {
    ok: false,
    error: "not_ready",
    delay: null,
    currentTime: null,
    liveEdge: null,
    updatedAt: 0
  };

  function getVideo() {
    const videos = Array.from(document.querySelectorAll("video"));

    if (videos.length === 0) {
      return null;
    }

    return (
      videos.find((video) => !Number.isNaN(video.duration) || video.readyState > 0) ||
      videos[0]
    );
  }

  function getBufferedInfo(video) {
    if (!video || !video.buffered || video.buffered.length === 0) {
      return null;
    }

    const firstIndex = 0;
    const lastIndex = video.buffered.length - 1;

    return {
      start: video.buffered.start(firstIndex),
      end: video.buffered.end(lastIndex)
    };
  }

  function calculateVideoDelayInfo() {
    const video = getVideo();

    if (!video) {
      return {
        ok: false,
        error: "video_not_found",
        delay: null,
        currentTime: null,
        liveEdge: null,
        updatedAt: Date.now()
      };
    }

    const buffered = getBufferedInfo(video);

    if (!buffered) {
      return {
        ok: false,
        error: "buffer_not_found",
        delay: null,
        currentTime: video.currentTime,
        liveEdge: null,
        updatedAt: Date.now()
      };
    }

    const delay = Math.max(0, buffered.end - video.currentTime);

    return {
      ok: true,
      delay,
      currentTime: video.currentTime,
      liveEdge: buffered.end,
      updatedAt: Date.now()
    };
  }

  function updateDisplayedDelayInfo() {
    displayedDelayInfo = calculateVideoDelayInfo();
    return displayedDelayInfo;
  }

  function getDisplayedDelayInfo() {
    // 아직 한 번도 계산되지 않았다면 즉시 한 번 계산
    if (!displayedDelayInfo.updatedAt) {
      return updateDisplayedDelayInfo();
    }

    return displayedDelayInfo;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function showStatus(text) {
    let box = document.getElementById("chzzk-syncer-status");

    if (!box) {
      box = document.createElement("div");
      box.id = "chzzk-syncer-status";
      box.style.position = "fixed";
      box.style.left = "50%";
      box.style.top = "80px";
      box.style.transform = "translateX(-50%)";
      box.style.zIndex = "999999";
      box.style.padding = "10px 14px";
      box.style.borderRadius = "999px";
      box.style.background = "rgba(0, 0, 0, 0.78)";
      box.style.color = "white";
      box.style.fontSize = "14px";
      box.style.fontWeight = "700";
      box.style.fontFamily = "Arial, sans-serif";
      box.style.pointerEvents = "none";
      document.body.appendChild(box);
    }

    box.textContent = text;
    box.style.display = "block";

    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => {
      box.style.display = "none";
    }, 900);
  }

  function seekBy(seconds) {
    const video = getVideo();

    if (!video) {
      showStatus("Chzzk Syncer: 영상을 찾지 못했어요");
      return { ok: false, error: "video_not_found" };
    }

    const buffered = getBufferedInfo(video);

    if (!buffered) {
      showStatus("Chzzk Syncer: 아직 버퍼가 없어요");
      return { ok: false, error: "buffer_not_found" };
    }

    const minTime = buffered.start + LIVE_EDGE_MARGIN;
    const maxTime = buffered.end - LIVE_EDGE_MARGIN;

    const target = clamp(video.currentTime + seconds, minTime, maxTime);

    video.currentTime = target;

    // 이동 직후 공통 지연시간도 바로 갱신
    updateDisplayedDelayInfo();
    updateChatDelayPlaceholder();

    if (seconds < 0) {
      showStatus(`${seconds.toFixed(1)}초`);
    } else {
      showStatus(`+${seconds.toFixed(1)}초`);
    }

    return {
      ok: true,
      currentTime: video.currentTime,
      liveEdge: buffered.end
    };
  }

  function goLive() {
    const video = getVideo();

    if (!video) {
      showStatus("Chzzk Syncer: 영상을 찾지 못했어요");
      return { ok: false, error: "video_not_found" };
    }

    const buffered = getBufferedInfo(video);

    if (!buffered) {
      showStatus("Chzzk Syncer: 아직 버퍼가 없어요");
      return { ok: false, error: "buffer_not_found" };
    }

    video.currentTime = buffered.end - LIVE_EDGE_MARGIN;

    // 이동 직후 공통 지연시간도 바로 갱신
    updateDisplayedDelayInfo();
    updateChatDelayPlaceholder();

    showStatus("최신 지점으로 이동");

    return {
      ok: true,
      currentTime: video.currentTime,
      liveEdge: buffered.end
    };
  }

  function setDelayFromLive(seconds) {
    const video = getVideo();

    if (!video) {
      showStatus("Chzzk Syncer: 영상을 찾지 못했어요");
      return { ok: false, error: "video_not_found" };
    }

    const buffered = getBufferedInfo(video);

    if (!buffered) {
      showStatus("Chzzk Syncer: 아직 버퍼가 없어요");
      return { ok: false, error: "buffer_not_found" };
    }

    const safeSeconds = Math.max(0, seconds);

    const target = clamp(
      buffered.end - safeSeconds,
      buffered.start + LIVE_EDGE_MARGIN,
      buffered.end - LIVE_EDGE_MARGIN
    );

    video.currentTime = target;

    // 이동 직후 공통 지연시간도 바로 갱신
    updateDisplayedDelayInfo();
    updateChatDelayPlaceholder();

    showStatus(`최신보다 ${safeSeconds.toFixed(1)}초 뒤`);

    return {
      ok: true,
      currentTime: video.currentTime,
      liveEdge: buffered.end,
      delay: safeSeconds
    };
  }

  function isTypingTarget(element) {
    if (!element) return false;

    const tagName = element.tagName?.toLowerCase();

    return (
      tagName === "input" ||
      tagName === "textarea" ||
      element.isContentEditable
    );
  }

  function findChatTextarea() {
    const byClass = document.querySelector("textarea.live_chatting_input_input__2F3Et");

    if (byClass) {
      return byClass;
    }

    const textareas = Array.from(document.querySelectorAll("textarea"));

    return (
      textareas.find((textarea) => {
        const placeholder = textarea.getAttribute("placeholder") || "";
        return (
          placeholder.includes("채팅을 입력") ||
          placeholder.includes("현재 지연")
        );
      }) || null
    );
  }

  function rememberOriginalChatPlaceholder(textarea) {
    if (!textarea || originalChatPlaceholder !== null) {
      return;
    }

    const currentPlaceholder = textarea.getAttribute("placeholder") || "";

    if (currentPlaceholder.startsWith("현재 지연")) {
      originalChatPlaceholder = DEFAULT_CHAT_PLACEHOLDER;
      return;
    }

    originalChatPlaceholder = currentPlaceholder || DEFAULT_CHAT_PLACEHOLDER;
  }

  function restoreChatPlaceholder() {
    const textarea = findChatTextarea();

    if (!textarea) {
      return;
    }

    rememberOriginalChatPlaceholder(textarea);
    textarea.setAttribute("placeholder", originalChatPlaceholder || DEFAULT_CHAT_PLACEHOLDER);
  }

  function updateChatDelayPlaceholder() {
    const textarea = findChatTextarea();

    if (!textarea) {
      return;
    }

    rememberOriginalChatPlaceholder(textarea);

    if (!showVideoDelayInChat) {
      restoreChatPlaceholder();
      return;
    }

    const delayInfo = getDisplayedDelayInfo();

    if (!delayInfo.ok) {
      textarea.setAttribute("placeholder", "현재 지연: -");
      return;
    }

    textarea.setAttribute("placeholder", `현재 지연: ${delayInfo.delay.toFixed(1)}초`);
  }

  function setShowVideoDelayInChat(show) {
    showVideoDelayInChat = Boolean(show);

    if (showVideoDelayInChat) {
      updateDisplayedDelayInfo();
      updateChatDelayPlaceholder();
      return;
    }

    restoreChatPlaceholder();
  }

  function sendFastForwardButtonVisibility(hidden) {
    window.dispatchEvent(
      new CustomEvent(EVENT_FAST_FORWARD_VISIBILITY, {
        detail: {
          hidden: Boolean(hidden)
        }
      })
    );
  }

  function loadSettings() {
    chrome.storage.sync.get(
      {
        [STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON]: false,
        [STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT]: false
      },
      (result) => {
        sendFastForwardButtonVisibility(
          result[STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON]
        );

        setShowVideoDelayInChat(
          result[STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT]
        );
      }
    );
  }

  window.addEventListener(EVENT_REQUEST_SETTINGS, () => {
    loadSettings();
  });

  loadSettings();
  setTimeout(loadSettings, 300);
  setTimeout(loadSettings, 1000);

  // 공통 표시용 지연시간은 여기서만 주기적으로 계산
  // 팝업창과 채팅창은 이 값을 같이 사용함
  updateDisplayedDelayInfo();

  setInterval(() => {
    updateDisplayedDelayInfo();

    if (showVideoDelayInChat) {
      updateChatDelayPlaceholder();
    }
  }, 1000);

  document.addEventListener(
    "keydown",
    (event) => {
      if (isTypingTarget(document.activeElement)) {
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        if (event.key === "ArrowLeft") {
          seekBy(-SMALL_STEP_SECONDS);
        }

        if (event.key === "ArrowRight") {
          seekBy(SMALL_STEP_SECONDS);
        }

        return;
      }

      if (event.key === "ArrowLeft") {
        seekBy(-NORMAL_STEP_SECONDS);
      }

      if (event.key === "ArrowRight") {
        seekBy(NORMAL_STEP_SECONDS);
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.source !== "CHZZK_SYNCER") {
      return;
    }

    if (message.action === "SET_DELAY") {
      const result = setDelayFromLive(Number(message.seconds));
      sendResponse(result);
      return;
    }

    if (message.action === "GO_LIVE") {
      const result = goLive();
      sendResponse(result);
      return;
    }

    if (message.action === "REWIND_STEP") {
      const result = seekBy(-SMALL_STEP_SECONDS);
      sendResponse(result);
      return;
    }

    if (message.action === "GET_VIDEO_DELAY") {
      const result = getDisplayedDelayInfo();
      sendResponse(result);
      return;
    }

    if (message.action === "SET_HIDE_FAST_FORWARD_BUTTON") {
      const hidden = Boolean(message.hidden);

      chrome.storage.sync.set(
        {
          [STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON]: hidden
        },
        () => {
          sendFastForwardButtonVisibility(hidden);
          sendResponse({
            ok: true,
            hidden
          });
        }
      );

      return true;
    }

    if (message.action === "SET_SHOW_VIDEO_DELAY_IN_CHAT") {
      const show = Boolean(message.show);

      chrome.storage.sync.set(
        {
          [STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT]: show
        },
        () => {
          setShowVideoDelayInChat(show);
          sendResponse({
            ok: true,
            show
          });
        }
      );

      return true;
    }
  });

  console.log("[Chzzk Syncer] content.js loaded");
})();