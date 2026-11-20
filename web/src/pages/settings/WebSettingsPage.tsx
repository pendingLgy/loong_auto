import { createSignal } from "solid-js";

import { useNavigate } from "@solidjs/router";

import { Effect } from "effect";

import { createLocalClient } from "@loong/client";
import { DEFAULT_LOCALE } from "@loong/ui/i18n";
import { Toast, type MessageType } from "@loong/ui/message";
import { SettingsPage, type ConfiguredServer } from "@loong/ui/settings";

import {
  activeServerId,
  servers,
  setActiveServer,
  updateServerStatus,
} from "../../storage/server_config";

interface ToastState {
  type: MessageType;
  text: string;
}

/** 设置页：`/settings` 嵌套路由，管理中栏的服务器 / 供应商 / 模型 / 账号。 */
export function WebSettingsPage() {
  const navigate = useNavigate();
  const [toast, setToast] = createSignal<ToastState | null>(null);

  const currentServerOption = () => {
    const list = servers();
    const active = list.find((item) => item.id === activeServerId()) ?? list[0];
    return active
      ? { id: active.id, name: active.name, serverUrl: active.serverUrl, token: active.token }
      : undefined;
  };

  const showToast = (type: MessageType, text: string) => {
    // 先关闭再下一帧打开，确保连续测试时自动关闭计时器重新开始。
    setToast(null);
    queueMicrotask(() => setToast({ type, text }));
  };

  const serverLabel = (server: ConfiguredServer) => server.name?.trim() || server.serverUrl;

  const findServer = (server: ConfiguredServer) =>
    server.id
      ? servers().find((item) => item.id === server.id)
      : servers().find((item) => item.serverUrl === server.serverUrl);

  const testServer = async (server: ConfiguredServer) => {
    const config = findServer(server);
    if (!config) return;

    try {
      const client = createLocalClient({
        origin: config.serverUrl,
        locale: DEFAULT_LOCALE,
        security_token: config.token,
      });
      await Effect.runPromise(client.health.security_token());
      updateServerStatus(config.id, true);
      showToast("success", `${serverLabel(config)} 连接正常`);
    } catch {
      updateServerStatus(config.id, false);
      showToast("error", `${serverLabel(config)} 连接失败`);
    }
  };

  return (
    <div class="mx-auto grid w-full max-w-5xl gap-4 p-6">
      <SettingsPage
        defaultSection="server"
        onBack={() => navigate("/")}
        server={{
          server: currentServerOption(),
          onSelectServer: (serverUrl) => {
            const target = servers().find((server) => server.serverUrl === serverUrl);
            if (target) setActiveServer(target.id);
          },
          onTestServer: testServer,
        }}
      />


      <Toast
        type={toast()?.type ?? "info"}
        open={toast() !== null}
        duration={2500}
        onClose={() => setToast(null)}
      >
        {toast()?.text}
      </Toast>
    </div>
  );
}
