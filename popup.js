const delayInput = document.getElementById("delaySeconds");
const applyButton = document.getElementById("applyButton");
const resetButton = document.getElementById("resetButton");
const increaseButton = document.getElementById("increaseButton");
const decreaseButton = document.getElementById("decreaseButton");
const hideFastForwardButtonCheckbox = document.getElementById("hideFastForwardButton");
const showVideoDelayInChatCheckbox = document.getElementById("showVideoDelayInChat");
const videoDelayStatus = document.getElementById("videoDelayStatus");

const STEP = 0.1;

const STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON = "hideFastForwardButton";
const STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT = "showVideoDelayInChat";

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function getDelaySeconds() {
  const value = Number(delayInput.value);

  if (Number.isNaN(value) || value < 0) {
    return 0;
  }

  return value;
}

function setDelaySeconds(value) {
  const safeValue = Math.max(0, roundToOneDecimal(value));
  delayInput.value = safeValue.toFixed(1);
}

function setVideoDelayStatusText(text) {
  videoDelayStatus.textContent = text;
}

async function sendToCurrentTab(message) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || !tab.id) {
    return {
      ok: false,
      error: "현재 탭을 찾지 못했어요."
    };
  }

  return await chrome.tabs.sendMessage(tab.id, {
    source: "CHZZK_SYNCER",
    ...message
  });
}

async function applyDelay() {
  const seconds = getDelaySeconds();
  setDelaySeconds(seconds);

  try {
    await sendToCurrentTab({
      action: "SET_DELAY",
      seconds
    });

    updateVideoDelayStatus();
  } catch (error) {
  }
}

async function resetToLive() {
  try {
    await sendToCurrentTab({
      action: "GO_LIVE"
    });

    updateVideoDelayStatus();
  } catch (error) {
  }
}

async function updateVideoDelayStatus() {
  try {
    const result = await sendToCurrentTab({
      action: "GET_VIDEO_DELAY"
    });

    if (result?.ok) {
      setVideoDelayStatusText(`현재 지연시간: ${result.delay.toFixed(1)}초`);
      return;
    }

    setVideoDelayStatusText("현재 지연시간: -");
  } catch (error) {
    setVideoDelayStatusText("현재 지연시간: -");
  }
}

function loadPopupSettings() {
  chrome.storage.sync.get(
    {
      [STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON]: false,
      [STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT]: false
    },
    (result) => {
      hideFastForwardButtonCheckbox.checked =
        Boolean(result[STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON]);

      showVideoDelayInChatCheckbox.checked =
        Boolean(result[STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT]);
    }
  );
}

async function setHideFastForwardButton(hidden) {
  chrome.storage.sync.set({
    [STORAGE_KEY_HIDE_FAST_FORWARD_BUTTON]: hidden
  });

  try {
    await sendToCurrentTab({
      action: "SET_HIDE_FAST_FORWARD_BUTTON",
      hidden
    });
  } catch (error) {
  }
}

async function setShowVideoDelayInChat(show) {
  chrome.storage.sync.set({
    [STORAGE_KEY_SHOW_VIDEO_DELAY_IN_CHAT]: show
  });

  try {
    await sendToCurrentTab({
      action: "SET_SHOW_VIDEO_DELAY_IN_CHAT",
      show
    });
  } catch (error) {
  }
}

increaseButton.addEventListener("click", () => {
  setDelaySeconds(getDelaySeconds() + STEP);
});

decreaseButton.addEventListener("click", () => {
  setDelaySeconds(getDelaySeconds() - STEP);
});

applyButton.addEventListener("click", () => {
  applyDelay();
});

resetButton.addEventListener("click", () => {
  resetToLive();
});

hideFastForwardButtonCheckbox.addEventListener("change", () => {
  setHideFastForwardButton(hideFastForwardButtonCheckbox.checked);
});

showVideoDelayInChatCheckbox.addEventListener("change", () => {
  setShowVideoDelayInChat(showVideoDelayInChatCheckbox.checked);
});

delayInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    applyDelay();
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    setDelaySeconds(getDelaySeconds() + STEP);
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setDelaySeconds(getDelaySeconds() - STEP);
  }
});

loadPopupSettings();
updateVideoDelayStatus();

setInterval(() => {
  updateVideoDelayStatus();
}, 1000);