(() => {
  const LIVE_EDGE_MARGIN = 0.15;
  const BUTTON_CLASS = "chzzk-syncer-ff";

  const EVENT_FAST_FORWARD_VISIBILITY = "CHZZK_SYNCER_FAST_FORWARD_VISIBILITY";
  const EVENT_REQUEST_SETTINGS = "CHZZK_SYNCER_REQUEST_SETTINGS";

  let hideFastForwardButton = false;

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
    if (tries > 500 || hideFastForwardButton) {
      return;
    }

    setTimeout(() => {
      installFastForwardButton(tries + 1);
    }, 50);
  }

  window.addEventListener(EVENT_FAST_FORWARD_VISIBILITY, (event) => {
    hideFastForwardButton = Boolean(event.detail?.hidden);

    if (hideFastForwardButton) {
      removeFastForwardButton();
      return;
    }

    installFastForwardButton();
  });

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
    installFastForwardButton();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  console.log("[Chzzk Syncer] player-button.js loaded");
})();