import { Show, createSignal, type Component } from "solid-js";

import { Effect } from "effect";

import { createLocalClient } from "@loong/client";
import { Dialog } from "@loong/ui/dialog";
import { DEFAULT_LOCALE } from "@loong/ui/i18n";
import { EyeIcon, EyeOffIcon } from "@loong/ui/icon";

import { serverConfig, updateServerStatus } from "../../storage/server_config";

export interface ServerInfoDialogProps {
  /** 关闭弹窗。 */
  onClose: () => void;
}

const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none transition readonly:bg-slate-50 dark:border-white/15 dark:bg-slate-950/60 dark:text-slate-100 dark:readonly:bg-slate-900/60";

/** 当前服务器信息：名称、地址、Token 与连通状态。 */
export const ServerInfoDialog: Component<ServerInfoDialogProps> = (props) => {
  const [showToken, setShowToken] = createSignal(false);
  const [testing, setTesting] = createSignal(false);
  const [testError, setTestError] = createSignal("");

  const current = () => serverConfig();

  const status = () => {
    const connected = current()?.connected;
    if (connected === true) {
      return { label: "已连接", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
    }
    if (connected === false) {
      return { label: "连接失败", dot: "bg-red-500", text: "text-red-600 dark:text-red-400" };
    }
    return { label: "未检测", dot: "bg-slate-300 dark:bg-slate-600", text: "text-slate-500 dark:text-slate-400" };
  };

  const testServer = async () => {
    const config = current();
    if (!config || testing()) return;

    setTesting(true);
    setTestError("");

    try {
      const client = createLocalClient({
        origin: config.serverUrl,
        locale: DEFAULT_LOCALE,
        security_token: config.token,
      });
      await Effect.runPromise(client.health.security_token());
      updateServerStatus(config.id, true);
    } catch (cause) {
      updateServerStatus(config.id, false);
      setTestError(cause instanceof Error && cause.message
        ? cause.message
        : "连接测试失败，请稍后再试");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog
      open
      onClose={props.onClose}
      size="md"
      header={
        <h2 class="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">
          服务器信息
        </h2>
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => props.onClose()}
            class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900/5 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
          >
            关闭
          </button>
          <button
            type="button"
            onClick={testServer}
            disabled={testing() || !current()}
            class="rounded-xl bg-linear-to-b from-sky-500 to-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-blue-500 disabled:cursor-progress disabled:opacity-70"
          >
            {testing() ? "测试中…" : "测试连接"}
          </button>
        </>
      }
    >
      <div class="grid gap-4">
        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">服务器名称</span>
          <input class={inputClass} type="text" readonly value={current()?.name ?? ""} />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">服务器地址</span>
          <input class={inputClass} type="url" readonly value={current()?.serverUrl ?? ""} />
        </label>

        <label class="grid gap-2">
          <span class="text-[13px] text-slate-600 dark:text-slate-300">Security Token</span>
          <div class="relative">
            <input
              class={`${inputClass} pr-10`}
              type={showToken() ? "text" : "password"}
              readonly
              value={current()?.token ?? ""}
            />
            <button
              type="button"
              onClick={() => setShowToken((value) => !value)}
              aria-label={showToken() ? "隐藏 Token" : "显示 Token"}
              title={showToken() ? "隐藏 Token" : "显示 Token"}
              class="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-slate-400 outline-none transition hover:bg-slate-900/5 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300"
            >
              {showToken() ? <EyeOffIcon class="h-4 w-4" /> : <EyeIcon class="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10">
          <span class={`h-2 w-2 shrink-0 rounded-full ${status().dot}`} aria-hidden="true" />
          <span class={`text-sm font-medium ${status().text}`}>{status().label}</span>
          <Show when={current()?.checkedAt}>
            <span class="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
              最近检查：{new Date(current()!.checkedAt!).toLocaleString()}
            </span>
          </Show>
        </div>

        <Show when={testError()}>
          <p
            class="m-0 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400"
            role="alert"
          >
            {testError()}
          </p>
        </Show>
      </div>
    </Dialog>
  );
};
