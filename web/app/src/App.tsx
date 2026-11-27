import type {ParentProps} from "solid-js";
import {UiI18nProvider} from "@loong/ui";

import {GlobalProvider} from "./context/GlobalContext";
import {LocaleProvider, useLocaleContext} from "./context/LocaleContext";
import {IndexView} from "./view/IndexView";

function UiLocaleProvider(props: ParentProps) {
  const {locale} = useLocaleContext();
  return <UiI18nProvider locale={locale}>{props.children}</UiI18nProvider>;
}

export function App() {
  return (
    <GlobalProvider>
      <LocaleProvider>
        <UiLocaleProvider>
          <IndexView/>
        </UiLocaleProvider>
      </LocaleProvider>
    </GlobalProvider>
  );
}
