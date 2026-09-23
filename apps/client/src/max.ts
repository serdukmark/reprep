type MaxBridge = {
  initData: string;
  ready?: () => void;
  expand?: () => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (f: () => void) => void;
    offClick: (f: () => void) => void;
  };
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  openLink?: (url: string) => void;
};
declare global {
  interface Window {
    WebApp?: MaxBridge;
    Telegram?: { WebApp?: MaxBridge };
  }
}
const params = new URLSearchParams(location.hash.slice(1));
const maxValues = params.getAll("WebAppData");
const telegramValues = params.getAll("tgWebAppData");
export const inTelegram = telegramValues.length > 0 || new URLSearchParams(location.search).get("platform") === "telegram";
export const inMax = maxValues.length > 0;
export const platformName = inTelegram ? "Telegram" : "MAX";
const bridge = () => inTelegram ? window.Telegram?.WebApp : window.WebApp;

export function launchData() {
  if (maxValues.length > 1 || telegramValues.length > 1 || (maxValues.length && telegramValues.length))
    throw Error("Некорректные параметры запуска мессенджера");
  const raw = bridge()?.initData || (inTelegram ? telegramValues[0] : maxValues[0]);
  if (!raw) throw Error(`Откройте мини-приложение из ${platformName}`);
  return raw;
}

export async function initializeMax() {
  if (!inMax && !inTelegram) return;
  document.documentElement.classList.add("max-embedded");
  if (inTelegram) document.documentElement.classList.add("telegram-embedded");
  if (!bridge()) await new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = inTelegram ? "https://telegram.org/js/telegram-web-app.js" : "https://st.max.ru/js/max-web-app.js";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.append(script);
    setTimeout(resolve, 3000);
  });
  if (inTelegram) { bridge()?.ready?.(); bridge()?.expand?.(); }
}

export function closingConfirmation(dirty: boolean) {
  if (dirty) bridge()?.enableClosingConfirmation?.();
  else bridge()?.disableClosingConfirmation?.();
}

export function bindMaxBack(back: (() => void) | null) {
  const button = bridge()?.BackButton;
  if (!button) return () => {};
  if (!back) {
    button.hide();
    return () => {};
  }
  button.show();
  button.onClick(back);
  return () => {
    button.offClick(back);
    button.hide();
  };
}
