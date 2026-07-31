const resetButton =
  document.getElementById("resetButton");

const seekButtons = Array.from(
  document.querySelectorAll(".seek-button")
);

const showVideoDelayInChatCheckbox =
  document.getElementById(
    "showVideoDelayInChat"
  );

const preventDelayCorrectionCheckbox =
  document.getElementById(
    "preventDelayCorrection"
  );

const videoDelayValue =
  document.getElementById(
    "videoDelayValue"
  );

const videoDelaySuffix =
  document.getElementById(
    "videoDelaySuffix"
  );

const disableNormalArrowKeysCheckbox =
  document.getElementById(
    "disableNormalArrowKeys"
  );

const hideFastForwardButtonCheckbox =
  document.getElementById(
    "hideFastForwardButton"
  );

const hideDelayBarCheckbox =
  document.getElementById(
    "hideDelayBar"
  );

const tabButtons = Array.from(
  document.querySelectorAll(".tab-button")
);

const tabPanels = Array.from(
  document.querySelectorAll(".tab-panel")
);

const tabContent =
  document.querySelector(".tab-content");

const STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT =
  "showVideoDelayInChat";

const STORAGE_KEY_PREVENT_DELAY_CORRECTION =
  "preventDelayCorrection";

const STORAGE_KEY_DISABLE_NORMAL_ARROW_KEYS =
  "disableNormalArrowKeys";

const STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON =
  "hideFastForwardButton";

const STORAGE_KEY_HIDE_DELAY_BAR =
  "hideDelayBar";

let delayStatusRequestRunning = false;

async function sendToCurrentTab(message) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab?.id) {
    return {
      ok: false,
      error: "current_tab_not_found"
    };
  }

  return chrome.tabs.sendMessage(tab.id, {
    source: "CHZZK_SYNCER",
    ...message
  });
}

function setUnavailableDelayStatus() {
  videoDelayValue.textContent = "-";
  videoDelaySuffix.textContent = "초";
}

async function updateVideoDelayStatus() {
  if (delayStatusRequestRunning) {
    return;
  }

  delayStatusRequestRunning = true;

  try {
    const result = await sendToCurrentTab({
      action: "GET_VIDEO_DELAY"
    });

    if (
      !result?.ok ||
      !Number.isFinite(result.delay)
    ) {
      setUnavailableDelayStatus();
      return;
    }

    const playbackRateMark =
      result.isPlaybackRateAdjusted
        ? "*"
        : "";

    videoDelayValue.textContent =
      result.delay.toFixed(3);

    videoDelaySuffix.textContent =
      `초${playbackRateMark}`;
  } catch (error) {
    setUnavailableDelayStatus();
  } finally {
    delayStatusRequestRunning = false;
  }
}

async function seekBy(seconds) {
  if (!Number.isFinite(seconds)) {
    return;
  }

  try {
    await sendToCurrentTab({
      action: "SEEK_BY",
      seconds
    });

    await updateVideoDelayStatus();
  } catch (error) {
    setUnavailableDelayStatus();
  }
}

async function resetToLive() {
  try {
    await sendToCurrentTab({
      action: "GO_LIVE"
    });

    await updateVideoDelayStatus();
  } catch (error) {
    setUnavailableDelayStatus();
  }
}

function activateTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive =
      button.dataset.tab === tabName;

    button.classList.toggle(
      "is-active",
      isActive
    );

    button.setAttribute(
      "aria-selected",
      String(isActive)
    );

    button.tabIndex = isActive ? 0 : -1;
  });

  tabPanels.forEach((panel) => {
    panel.hidden =
      panel.dataset.panel !== tabName;
  });

  /*
   * 다른 탭으로 이동할 때
   * 스크롤을 맨 위로 되돌린다.
   */
  if (tabContent) {
    tabContent.scrollTop = 0;
  }
}

function loadPopupSettings() {
  chrome.storage.sync.get(
    {
      [STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT]:
        false,

      [STORAGE_KEY_PREVENT_DELAY_CORRECTION]:
        false,

      [STORAGE_KEY_DISABLE_NORMAL_ARROW_KEYS]:
        false,

      [STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON]:
        false,

      [STORAGE_KEY_HIDE_DELAY_BAR]:
        false
    },
    (result) => {
      showVideoDelayInChatCheckbox.checked =
        Boolean(
          result[
            STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT
          ]
        );

      preventDelayCorrectionCheckbox.checked =
        Boolean(
          result[
            STORAGE_KEY_PREVENT_DELAY_CORRECTION
          ]
        );

      disableNormalArrowKeysCheckbox.checked =
        Boolean(
          result[
            STORAGE_KEY_DISABLE_NORMAL_ARROW_KEYS
          ]
        );

      hideFastForwardButtonCheckbox.checked =
        Boolean(
          result[
            STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON
          ]
        );

      hideDelayBarCheckbox.checked =
        Boolean(
          result[
            STORAGE_KEY_HIDE_DELAY_BAR
          ]
        );
    }
  );
}

async function setShowVideoDelayInChat(
  show
) {
  chrome.storage.sync.set({
    [STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT]:
      show
  });

  try {
    await sendToCurrentTab({
      action:
        "SET_SHOW_VIDEO_DELAY_IN_CHAT",
      show
    });
  } catch (error) {
    /*
     * 현재 치지직 페이지가 아니더라도
     * 설정은 storage에 저장된다.
     */
  }
}

async function setPreventDelayCorrection(
  prevent
) {
  chrome.storage.sync.set({
    [STORAGE_KEY_PREVENT_DELAY_CORRECTION]:
      prevent
  });

  try {
    await sendToCurrentTab({
      action:
        "SET_PREVENT_DELAY_CORRECTION",
      prevent
    });
  } catch (error) {
    /*
     * 현재 치지직 페이지가 아니더라도
     * 설정은 storage에 저장된다.
     */
  }
}

async function setDisableNormalArrowKeys(
  disabled
) {
  chrome.storage.sync.set({
    [STORAGE_KEY_DISABLE_NORMAL_ARROW_KEYS]:
      disabled
  });

  try {
    await sendToCurrentTab({
      action:
        "SET_DISABLE_NORMAL_ARROW_KEYS",
      disabled
    });
  } catch (error) {
    /*
     * 현재 탭이 치지직 라이브 페이지가 아니어도
     * 설정 자체는 저장된다.
     */
  }
}

async function setHideFastForwardButton(
  hidden
) {
  chrome.storage.sync.set({
    [STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON]:
      hidden
  });

  try {
    await sendToCurrentTab({
      action:
        "SET_HIDE_FAST_FORWARD_BUTTON",
      hidden
    });
  } catch (error) {
    /*
     * 현재 치지직 페이지가 아니더라도
     * 설정은 storage에 저장된다.
     */
  }
}

async function setHideDelayBar(hidden) {
  chrome.storage.sync.set({
    [STORAGE_KEY_HIDE_DELAY_BAR]:
      hidden
  });

  try {
    await sendToCurrentTab({
      action: "SET_HIDE_DELAY_BAR",
      hidden
    });
  } catch (error) {
    /*
     * 현재 탭이 치지직 방송 페이지가 아니어도
     * 설정값 자체는 storage에 저장된다.
     */
  }
}

function flashActionButton(button) {
  if (!button) {
    return;
  }

  /*
   * 빠르게 연속 클릭해도
   * 애니메이션을 처음부터 다시 실행한다.
   */
  button.classList.remove("is-flashing");

  void button.offsetWidth;

  button.classList.add("is-flashing");

  clearTimeout(button.flashTimer);

  button.flashTimer = setTimeout(() => {
    button.classList.remove("is-flashing");
  }, 300);
}

/*
 * 여섯 개 이동 버튼
 *
 * data-seconds 값:
 * -5, -1, -0.1, 0.1, 1, 5
 */
seekButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const seconds =
      Number(button.dataset.seconds);

    flashActionButton(button);
    seekBy(seconds);
  });
});

resetButton.addEventListener(
  "click",
  () => {
    flashActionButton(resetButton);
    resetToLive();
  }
);

tabButtons.forEach((button) => {
  button.addEventListener(
    "click",
    () => {
      activateTab(button.dataset.tab);
    }
  );
});

showVideoDelayInChatCheckbox.addEventListener(
  "change",
  () => {
    setShowVideoDelayInChat(
      showVideoDelayInChatCheckbox.checked
    );
  }
);

preventDelayCorrectionCheckbox.addEventListener(
  "change",
  () => {
    setPreventDelayCorrection(
      preventDelayCorrectionCheckbox.checked
    );
  }
);

disableNormalArrowKeysCheckbox.addEventListener(
  "change",
  () => {
    setDisableNormalArrowKeys(
      disableNormalArrowKeysCheckbox.checked
    );
  }
);

hideFastForwardButtonCheckbox.addEventListener(
  "change",
  () => {
    setHideFastForwardButton(
      hideFastForwardButtonCheckbox.checked
    );
  }
);

hideDelayBarCheckbox.addEventListener(
  "change",
  () => {
    setHideDelayBar(
      hideDelayBarCheckbox.checked
    );
  }
);

/*
 * 팝업을 열면 기능 탭을 기본으로 표시한다.
 */
activateTab("features");

loadPopupSettings();
updateVideoDelayStatus();

setInterval(() => {
  updateVideoDelayStatus();
}, 1000);
