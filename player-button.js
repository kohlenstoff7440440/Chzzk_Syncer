(() => {
  const LIVE_EDGE_MARGIN = 1.1;
  const BUTTON_CLASS = "chzzk-syncer-ff";

  const DELAY_BAR_CLASS = "chzzk-syncer-delay-bar";
  const DELAY_BAR_STYLE_ID = "chzzk-syncer-delay-bar-style";

  let delayBarState = {
    pzp: null,
    video: null,
    root: null,
    played: null,
    handle: null,
    tooltip: null,

    dragging: false,
    hovering: false,
    playerGovering: false,

    lastClientX: null,

    targetPercent: 0,
    renderedPercent: 0,
    lastAnimationTime: 0,

    playerEventController: null
  };

  const EVENT_REQUEST_SETTINGS = "CHZZK_SYNCER_REQUEST_SETTINGS";
  const EVENT_FAST_FORWARD_VISIBILITY = "CHZZK_SYNCER_FAST_FORWARD_VISIBILITY";
  const EVENT_DELAY_BAR_VISIBILITY = "CHZZK_SYNCER_DELAY_BAR_VISIBILITY";

  let hideFastForwardButton = false;
  let hideDelayBar = false;

  function isLivePage() {
    return location.hostname === "chzzk.naver.com" && location.pathname.startsWith("/live/");
  }

  function getVideo(root = document) {
    const videos = Array.from(root.querySelectorAll("video"));

    if (videos.length === 0) {
      return document.querySelector("video");
    }

    return (
      videos.find((video) => !Number.isNaN(video.duration) || video.readyState > 0) ||
      videos[0]
    );
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

  function goLive(root = document) {
    if (!isLivePage()) {
      removeFastForwardButton();
      return;
    }

    const video = getVideo(root);

    if (!video) {
      showStatus("Chzzk Syncer: 영상을 찾지 못했어요");
      return;
    }

    if (!video.buffered || video.buffered.length === 0) {
      showStatus("Chzzk Syncer: 아직 버퍼가 없어요");
      return;
    }

    video.currentTime = video.buffered.end(video.buffered.length - 1) - LIVE_EDGE_MARGIN;
    showStatus("최신 지점으로 이동");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getBufferedRange(video) {
    if (!video?.buffered || video.buffered.length === 0) {
      return null;
    }

    try {
      const start = video.buffered.start(0);
      const end = video.buffered.end(video.buffered.length - 1);

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
      ) {
        return null;
      }
  
      return {
        start,
        end,
        duration: end - start
      };
    } catch (error) {
      return null;
    }
  }
  
  function formatDelayFromLive(seconds) {
    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
  
    return `-${minutes}:${remainingSeconds}`;
  }

  function installDelayBarStyle() {
    if (document.getElementById(DELAY_BAR_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = DELAY_BAR_STYLE_ID;

    style.textContent = `
      .${DELAY_BAR_CLASS} {
        position: absolute;
        left: 20px;
        right: 20px;
        bottom: 58px;
        height: 22px;
        z-index: 50;

        opacity: 0;
        visibility: hidden;
        pointer-events: none;

        transform: translateY(4px);

        transition:
          opacity 150ms cubic-bezier(0.22, 1, 0.36, 1),
          transform 150ms cubic-bezier(0.22, 1, 0.36, 1),
          visibility 0s linear 150ms;

        will-change: opacity, transform;
        
        touch-action: none;
        user-select: none;
        cursor: pointer;
      }

      .${DELAY_BAR_CLASS}.is-visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;

        transform: translateY(0);

        transition:
          opacity 150ms cubic-bezier(0.22, 1, 0.36, 1),
          transform 150ms cubic-bezier(0.22, 1, 0.36, 1),
          visibility 0s linear 0s;
      }

      .${DELAY_BAR_CLASS}__track {
        position: absolute;
        left: 0;
        right: 0;
        top: 9px;
        height: 4px;

        overflow: hidden;
        border-radius: 999px;

        /* 아직 재생하지 않은 버퍼 구간 */
        background: rgba(175, 181, 190, 0.72);

        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.18);

        transition:
          height 140ms cubic-bezier(0.22, 1, 0.36, 1),
          top 140ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      .${DELAY_BAR_CLASS}:hover
      .${DELAY_BAR_CLASS}__track,
      .${DELAY_BAR_CLASS}.is-dragging
      .${DELAY_BAR_CLASS}__track {
        top: 8px;
        height: 6px;
      }

      .${DELAY_BAR_CLASS}__played {
        width: 100%;
        height: 100%;

        border-radius: inherit;

        /* 이미 지나간 구간 */
        background: #2f80ed;

        transform: scaleX(0);
        transform-origin: left center;

        will-change: transform;
        pointer-events: none;
      }

      .${DELAY_BAR_CLASS}__handle {
        position: absolute;
        left: 0;
        top: 5px;

        width: 12px;
        height: 12px;

        box-sizing: border-box;

        border: 2px solid #2f80ed;
        border-radius: 50%;

        background: #ffffff;

        transform: translateX(-50%);

        box-shadow:
          0 1px 4px rgba(0, 0, 0, 0.55);

          will-change: left;
          pointer-events: none;
      } 

      .${DELAY_BAR_CLASS}__tooltip {
        position: absolute;
        left: 0;
        bottom: 25px;

        min-width: 42px;
        padding: 5px 7px;

        border-radius: 5px;

        background: rgba(0, 0, 0, 0.88);
        color: #ffffff;

        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: 700;
        line-height: 1;

        text-align: center;
        white-space: nowrap;

        transform: translateX(-50%);

        opacity: 0;
        visibility: hidden;

        transform: translate(-50%, 4px);

        transition:
          opacity 110ms ease,
          transform 110ms ease,
          visibility 0s linear 110ms;

        pointer-events: none;
      }

      .${DELAY_BAR_CLASS}:hover
      .${DELAY_BAR_CLASS}__tooltip,
      .${DELAY_BAR_CLASS}.is-dragging
      .${DELAY_BAR_CLASS}__tooltip {
        opacity: 1;
        visibility: visible;

        transform: translate(-50%, 0);

        transition:
          opacity 110ms ease,
          transform 110ms ease,
          visibility 0s linear 0s;
      }
    `;

    document.head.appendChild(style);
  }

  function resetDelayBarState() {
    delayBarState = {
      pzp: null,
      video: null,
      root: null,
      played: null,
      handle: null,
      tooltip: null,

      dragging: false,
      hovering: false,
      playerHovering: false,

      lastClientX: null,

      targetPercent: 0,
      renderedPercent: 0,
      lastAnimationTime: 0,

      playerEventController: null
    };
  }

  function removeDelayBar() {
    if (delayBarState.playerEventController) {
      delayBarState.playerEventController.abort();
    } 
    
    document
      .querySelectorAll(`.${DELAY_BAR_CLASS}`)
      .forEach((bar) => {
        bar.remove();
      });

    resetDelayBarState();
  }

  function getDelayBarPercent(clientX) {
    const root = delayBarState.root;

    if (!root) {
      return 0;
    }

    const rect = root.getBoundingClientRect();

    if (rect.width <= 0) {
      return 0;
    }

    return clamp(
      (clientX - rect.left) / rect.width,
      0,
      1
    );
  }

  function renderDelayBarPercent(percent) {
    const safePercent = clamp(percent, 0, 1);

    if (delayBarState.played) {
      delayBarState.played.style.transform =
        `scaleX(${safePercent})`;
    }

    if (delayBarState.handle) {
      delayBarState.handle.style.left =
        `${safePercent * 100}%`;
    }
  }

  function setDelayBarTargetPercent(
    percent,
    immediate = false
  ) {
    const safePercent = clamp(percent, 0, 1);

    delayBarState.targetPercent = safePercent;

    if (immediate) {
      delayBarState.renderedPercent = safePercent;
      renderDelayBarPercent(safePercent);
    }
  }

  function updateDelayBarMotion(timestamp) {
    const {
      root,
      dragging,
      targetPercent
    } = delayBarState;

    if (!root?.isConnected) {
      return;
    }

    if (!delayBarState.lastAnimationTime) {
      delayBarState.lastAnimationTime = timestamp;
    }

    const deltaTime = Math.min(
      50,
      timestamp - delayBarState.lastAnimationTime
    );

    delayBarState.lastAnimationTime = timestamp;

    /*
     * 드래그 중에는 마우스를 빠르게 따라가고,
     * 일반 재생 중에는 조금 더 부드럽게 움직인다.
     */
    const smoothTime = dragging ? 28 : 65;

    const smoothing =
      1 - Math.exp(-deltaTime / smoothTime);

    delayBarState.renderedPercent +=
      (
        targetPercent -
        delayBarState.renderedPercent
      ) * smoothing;

    if (
      Math.abs(
        targetPercent -
        delayBarState.renderedPercent
      ) < 0.0001
    ) {
      delayBarState.renderedPercent =
        targetPercent;
    }

    renderDelayBarPercent(
      delayBarState.renderedPercent
    );
  }

  function updateDelayBarTooltip(clientX) {
    const {
      root,
      tooltip,
      video
    } = delayBarState;

    if (!root || !tooltip || !video) {
      return;
    }

    const range = getBufferedRange(video);
  
    if (!range) {
      return;
    }

    const percent = getDelayBarPercent(clientX);

    const targetTime =
      range.start +
      range.duration * percent;

    const delayFromLive = Math.max(
      0,
      range.end - targetTime
    );

    const rect = root.getBoundingClientRect();

    /*
     * 툴팁이 바의 좌우 바깥으로 너무 많이
     * 튀어나가지 않도록 위치를 제한한다.
     */
    const tooltipLeft = clamp(
      percent * rect.width,
      24,
      Math.max(24, rect.width - 24)
    );

    tooltip.style.left = `${tooltipLeft}px`;
    tooltip.textContent =
      formatDelayFromLive(delayFromLive);
  }

  function seekFromDelayBar(clientX) {
    const video = delayBarState.video;
 
    if (!video) {
      return null;
    }

    const range = getBufferedRange(video);
 
    if (!range) {
      return null;
    }
  
    const percent = getDelayBarPercent(clientX);
  
    /*
     * 여기에는 LIVE_EDGE_MARGIN을 사용하지 않는다.
     *
     * 오른쪽 끝까지 클릭하거나 드래그하면
     * buffered.end()로 정확히 이동한다.
     */
    const targetTime =
      percent >= 1
        ? range.end
        : range.start + range.duration * percent;

    video.currentTime = targetTime;

    setDelayBarTargetPercent(percent);
    updateDelayBarTooltip(clientX);

    return {
      targetTime,
      delayFromLive: Math.max(
        0,
        range.end - targetTime
      )
    };
  }

  function bindPlayerHoverEvents(pzp) {
    if (delayBarState.playerEventController) {
      delayBarState.playerEventController.abort();
    }

    const controller = new AbortController();

    delayBarState.playerEventController =
      controller;

    const signal = controller.signal;

    pzp.addEventListener(
      "pointerenter",
      () => {
        delayBarState.playerHovering = true;
        syncDelayBarVisibility();
      },
      {
        signal
      }
    );

    pzp.addEventListener(
      "pointerleave",
      () => {
        /*
         * 치지직 버튼의 opacity가 사라지기를
         * 기다리지 않고 즉시 페이드아웃을 시작한다.
         */
        delayBarState.playerHovering = false;
        syncDelayBarVisibility();
      },
      {
        signal
      }
    );

    /*
     * 라이브 바가 설치되는 순간 이미 마우스가
     * 플레이어 위에 있을 수 있으므로 초기값 확인.
     */
    delayBarState.playerHovering =
      pzp.matches(":hover");
  }

  function syncDelayBarVisibility() {
    const {
      root,
      pzp,
      dragging,
      playerHovering
    } = delayBarState;

    if (
      !root ||
      !pzp ||
      !root.isConnected
    ) {
      return;
    }

    const shouldShow =
      playerHovering ||
      dragging;
  
    root.classList.toggle(
      "is-visible",
      shouldShow
    );
  }

 function updateDelayBar(immediate = false) {
    const {
      root,
      video,
      dragging,
      lastClientX
    } = delayBarState;

    if (
      !root ||
      !video ||
      !root.isConnected
    ) {
      return;
    }

    const range = getBufferedRange(video);

    if (!range) {
      root.style.display = "none";
      return;
    }

    root.style.display = "block";

    if (!dragging) {
      const currentTime = clamp(
        video.currentTime,
        range.start,
        range.end
      );

      const percent =
        (currentTime - range.start) /
        range.duration;

      setDelayBarTargetPercent(
        percent,
        immediate
      );
    }

    if (
      lastClientX !== null &&
      (
        delayBarState.hovering ||
        dragging
      )
    ) {
      updateDelayBarTooltip(lastClientX);
    }
  }

  function bindDelayBarEvents(root) {
    root.addEventListener(
      "pointerenter",
      (event) => {
        delayBarState.hovering = true;
        delayBarState.lastClientX =
          event.clientX;

        updateDelayBarTooltip(event.clientX);
        syncDelayBarVisibility();
      }
    );

    root.addEventListener(
      "pointermove",
      (event) => {
        delayBarState.lastClientX =
          event.clientX;

        updateDelayBarTooltip(event.clientX);

        if (delayBarState.dragging) {
          seekFromDelayBar(event.clientX);
        }
      }
    );

    root.addEventListener(
      "pointerleave",
      () => {
        delayBarState.hovering = false;

        if (!delayBarState.dragging) {
          delayBarState.lastClientX = null;
        }

        syncDelayBarVisibility();
      }
    );

    root.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) {
          return;
        }

        /*
         * 플레이어의 원래 클릭 동작이 실행되어
         * 영상이 일시정지되는 것을 막는다.
         */
        event.preventDefault();
        event.stopPropagation();

        delayBarState.dragging = true;
        delayBarState.lastClientX =
          event.clientX;

        root.classList.add("is-dragging");
        root.setPointerCapture(event.pointerId);

        /*
         * 클릭하는 순간 바로 해당 위치로 이동한다.
         */
        seekFromDelayBar(event.clientX);
        syncDelayBarVisibility();
      }
    );

    root.addEventListener(
      "pointerup",
      (event) => {
        if (!delayBarState.dragging) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        const result =
          seekFromDelayBar(event.clientX);

        if (
          root.hasPointerCapture(event.pointerId)
        ) {
          root.releasePointerCapture(
            event.pointerId
          );
        }

        delayBarState.dragging = false;
        root.classList.remove("is-dragging");

        if (result) {
          if (result.delayFromLive < 0.05) {
            showStatus("최신 지점으로 이동");
          } else {
            showStatus(
              `${formatDelayFromLive(
                result.delayFromLive
              )} 지점으로 이동`
            );
          }
        }

        syncDelayBarVisibility();
      }
    );

    root.addEventListener(
      "pointercancel",
      (event) => {
        if (
          root.hasPointerCapture(event.pointerId)
        ) {
          root.releasePointerCapture(
            event.pointerId
          );
        }

        delayBarState.dragging = false;
        root.classList.remove("is-dragging");

        syncDelayBarVisibility();
      }
    );

    root.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      }
    );
  }

  function installDelayBar() {
    if (
      !isLivePage() ||
      hideDelayBar
    ) {
      removeDelayBar();
      return;
    }

    const pzp = document.querySelector(".pzp-pc");
  
    if (!pzp) {
      return;
    }

    const video = getVideo(pzp);

    if (!video) {
      return;
    }

    /*
     * 플레이어 DOM이 그대로라면 다시 만들지 않고
     * video 참조만 최신 상태로 교체한다.
     */
    if (
      delayBarState.root?.isConnected &&
      delayBarState.pzp === pzp
    ) {
      delayBarState.video = video;
      return;
    }

    removeDelayBar();
    installDelayBarStyle();

    const root = document.createElement("div");

    root.className = DELAY_BAR_CLASS;

    root.innerHTML = `
      <div class="${DELAY_BAR_CLASS}__track">
        <div class="${DELAY_BAR_CLASS}__played"></div>
      </div>

      <div class="${DELAY_BAR_CLASS}__handle"></div>

      <div class="${DELAY_BAR_CLASS}__tooltip">
        -0:00
      </div>
    `;

    /*
     * 플레이어 내부에 넣기 때문에 전체화면에서도
     * 플레이어 크기에 맞춰 함께 움직인다.
     */
    pzp.appendChild(root);

    delayBarState.pzp = pzp;
    delayBarState.video = video;
    delayBarState.root = root;

    delayBarState.played = root.querySelector(
      `.${DELAY_BAR_CLASS}__played`
    );

    delayBarState.handle = root.querySelector(
      `.${DELAY_BAR_CLASS}__handle`
    );

    delayBarState.tooltip = root.querySelector(
      `.${DELAY_BAR_CLASS}__tooltip`
    );

    bindPlayerHoverEvents(pzp);
    bindDelayBarEvents(root);
  
    updateDelayBar(true);
    syncDelayBarVisibility();
  }

  function runDelayBarAnimationFrame(timestamp) {
    if (
      isLivePage() &&
      !hideDelayBar
    ) {
      if (!delayBarState.root?.isConnected) {
        installDelayBar();
      }

      updateDelayBar();
      updateDelayBarMotion(timestamp);
      syncDelayBarVisibility();
    }

    requestAnimationFrame(
      runDelayBarAnimationFrame
    );
  }

  requestAnimationFrame(
    runDelayBarAnimationFrame
  );

  function getVueConstructor(pzp) {
    let vueInstance = pzp?.__vue__;

    if (!vueInstance) {
      return null;
    }

    while (vueInstance != null && !Object.hasOwn(vueInstance, "$mount")) {
      vueInstance = Object.getPrototypeOf(vueInstance);
    }

    return vueInstance?.constructor || null;
  }

  function removeFastForwardButton() {
    document.querySelectorAll(`.${BUTTON_CLASS}`).forEach((button) => {
      button.remove();
    });
  }

  function installFastForwardButton(tries = 0) {

    if (!isLivePage()) {
      removeFastForwardButton();
      removeDelayBar();
      return;
    }

    installDelayBar();

    if (hideFastForwardButton) {
      removeFastForwardButton();
      return;
    }

    const pzp = document.querySelector(".pzp-pc");

    if (!pzp) {
      retryInstall(tries);
      return;
    }

    if (pzp.querySelector(`.${BUTTON_CLASS}`)) {
      return;
    }

    const playButton = pzp.querySelector(".pzp-pc__playback-switch");

    if (!playButton) {
      retryInstall(tries);
      return;
    }

    const Vue = getVueConstructor(pzp);

    if (!Vue) {
      retryInstall(tries);
      return;
    }

    try {
      const ffButton = new Vue({
        template: `
          <pzp-pc-ui-button
            class="pzp-pc__playback-switch ${BUTTON_CLASS}"
            label="빨리감기"
            aria-label="빨리감기"
            tooltip="빨리감기"
            @click="fastForward"
          >
            <ui-next-media-icon></ui-next-media-icon>
          </pzp-pc-ui-button>
        `,
        methods: {
          fastForward() {
            goLive(pzp);
          }
        }
      });

      ffButton.$mount();
      playButton.insertAdjacentElement("afterend", ffButton.$el);
    } catch (error) {
      console.warn("[Chzzk Syncer] 플레이어 버튼 생성 실패", error);
    }
  }

  function retryInstall(tries) {
    if (!isLivePage()) {
      removeFastForwardButton();
      removeDelayBar();
      return;
    }

    if (tries > 500 || hideFastForwardButton) {
      return;
    }

    setTimeout(() => {
      installFastForwardButton(tries + 1);
    }, 50);
  }

  window.addEventListener(
    EVENT_FAST_FORWARD_VISIBILITY
    , (event) => {
      hideFastForwardButton =
       Boolean(event.detail?.hidden);

      if (!isLivePage()) {
        removeFastForwardButton();
        removeDelayBar();
        return;
      }

      installDelayBar();

      if (hideFastForwardButton) {
        removeFastForwardButton();
        return;
      }

      installFastForwardButton();
    }
  );

  window.addEventListener(
    EVENT_DELAY_BAR_VISIBILITY,
    (event) => {
      hideDelayBar =
        Boolean(event.detail?.hidden);

      if (
        hideDelayBar ||
        !isLivePage()
      ) {
        removeDelayBar();
        return;
      }

      installDelayBar();
    }
  );

  // content.js에게 저장된 설정값을 요청
  window.dispatchEvent(new CustomEvent(EVENT_REQUEST_SETTINGS));

  // 혹시 content.js가 아직 준비 전일 수 있으니 몇 번 더 요청
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(EVENT_REQUEST_SETTINGS));
  }, 300);

  setTimeout(() => {
    window.dispatchEvent(new CustomEvent(EVENT_REQUEST_SETTINGS));
  }, 1000);

  installFastForwardButton();

  const observer = new MutationObserver(() => {
    if(!isLivePage()) {
      removeFastForwardButton();
      removeDelayBar();
      return;
    }

    installFastForwardButton();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  setInterval(() => {
    if (!isLivePage()) {
      removeFastForwardButton();
      removeDelayBar();
      return;
    }

    installFastForwardButton();
  }, 1000);

  setInterval(() => {
    if(!isLivePage()) {
      return;
    }

    if(!delayBarState.root?.isConnected) {
      installDelayBar();
    }

    updateDelayBar();
    syncDelayBarVisibility();    
  }, 100);

  console.log("[Chzzk Syncer] player-button.js loaded");
})();
