"""业务缓存 key 模板；全局 prefix 由 CacheProxy 统一添加。"""

from typing import Final


TOKEN_SESSION_KEY: Final[str] = "{{{user_id}}}:token:session:{jti}"
ACCESS_TOKEN_KEY: Final[str] = "{{{user_id}}}:access_key:{jti}"
REFRESH_TOKEN_KEY: Final[str] = "{{{user_id}}}:refresh_key:{jti}"
