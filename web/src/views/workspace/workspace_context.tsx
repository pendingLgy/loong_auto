import { serverConfig } from "../../storage/server_config";
import { currentUser } from "../../storage/user";
import { getWorkspaceState } from "../../storage/workspace";

/** WorkspaceView 初始化所需的本地数据。 */
export function useWorkspaceLocalData() {
  return {
    initial: getWorkspaceState(),
    currentUser,
    serverConfig,
  };
}
