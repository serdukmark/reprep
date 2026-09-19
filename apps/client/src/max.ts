type MaxBridge = {
  initData: string;
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
const launchValues = params.getAll("WebAppData");
export const inMax = launchValues.length > 0;

export function launchData() {
  if (launchValues.length > 1)
    throw Error("Повторяющиеся параметры запуска MAX");
  const raw = window.WebApp?.initData || launchValues[0];
  if (!raw) throw Error("Откройте мини-приложение из MAX");
  return raw;
}

export async function initializeMax() {
  if (!inMax || window.WebApp) return;
  document.documentElement.classList.add("max-embedded");
  try {
    sessionStorage.getItem("reprep.bridge.probe");
  } catch {
    return;
  }

  await new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://st.max.ru/js/max-web-app.js";
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.append(script);
    setTimeout(resolve, 3000);
  });
  document.documentElement.classList.add("max-embedded");
}

export function closingConfirmation(dirty: boolean) {
  if (dirty) window.WebApp?.enableClosingConfirmation?.();
  else window.WebApp?.disableClosingConfirmation?.();
}

export function bindMaxBack(back: (() => void) | null) {
  const button = window.WebApp?.BackButton;
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
