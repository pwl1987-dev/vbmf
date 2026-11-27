import type * as React from "react";
import { useSyncExternalStore } from "react";
import { getLocale, setLocale, subscribeLocale } from "./index.ts";

/** 🌐 切换按钮（线框 01-dashboard 左上角同款语义）：点一下当场全站生效。 */
export function LocaleToggle(): React.JSX.Element {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getLocale);
  return (
    <button
      className="secondary"
      type="button"
      onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}
    >
      🌐 {locale === "zh-CN" ? "EN" : "中文"}
    </button>
  );
}
