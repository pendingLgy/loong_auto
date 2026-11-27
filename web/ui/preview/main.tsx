import { render } from "@solidjs/web";

import { UiI18nProvider } from "../src";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("缺少 #root 挂载点");
}

const savedLocale = localStorage.getItem("loong.ui.preview.locale");
const locale = savedLocale === "en-US" ? "en-US" : "zh-CN";

render(() => <UiI18nProvider locale={locale}><App /></UiI18nProvider>, root);
