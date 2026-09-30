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
  }
}
const params = new URLSearchParams(location.hash.slice(1));
const maxValues = params.getAll("WebAppData");
export const inMax = maxValues.length > 0;
export const platformName = "MAX";
const bridge = () => window.WebApp;

export function launchData() {
  if (maxValues.length > 1)
    throw Error("Некорректные параметры запуска мессенджера");
  const raw = bridge()?.initData || maxValues[0];
  if (!raw) throw Error(`Откройте мини-приложение из ${platformName}`);
  return raw;
}

export async function initializeMax() {
  if (!inMax) return;
  document.documentElement.classList.add("max-embedded");
  if (!bridge()) await new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://st.max.ru/js/max-web-app.js";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.append(script);
    setTimeout(resolve, 3000);
  });
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
