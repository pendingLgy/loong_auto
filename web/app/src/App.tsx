import {GlobalProvider} from "./context/GlobalContext";
import {IndexView} from "./view/IndexView";
import {LocaleProvider} from "./context/LocaleContext";

export function App() {
  return (
    <GlobalProvider>
      <LocaleProvider>
        <IndexView/>
      </LocaleProvider>
    </GlobalProvider>
  );
}
