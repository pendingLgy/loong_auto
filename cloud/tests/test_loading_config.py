import importlib.util
import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from pydantic import ValidationError

from loong_cloud.config.config_global import GlobalConfig, load_global_config, loading_config


class LoadingConfigTests(unittest.TestCase):
    def test_env_returns_global_config_and_cleans_temporary_file(self):
        with TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            path = Path(directory) / ".env"
            path.write_text(
                'LOONG_LOG_LEVEL=DEBUG\n'
                'LOONG_WHITE_LIST_URLS=["/api/status"]\n'
                'LOONG_DB_CONFIG__DB_TYPE=mysql\n'
                'LOONG_DB_CONFIG__POOL__SIZE=8\n'
                'LOONG_DB_CONFIG__POOL__PRE_PING=false\n',
                encoding="utf-8",
            )
            config = GlobalConfig.load(path)
            self.assertIsInstance(config, GlobalConfig)
            self.assertEqual(config.log_level, "DEBUG")
            self.assertEqual(config.white_list_urls, ["/api/status"])
            self.assertEqual(config.db_config.db_type, "mysql")
            self.assertEqual(config.db_config.pool.size, 8)
            self.assertFalse(config.db_config.pool.pre_ping)
            self.assertEqual(config.db_config.pool.timeout, 30)
            self.assertNotIn("LOONG_LOG_LEVEL", os.environ)
        self.assertFalse(path.exists())
        self.assertFalse(Path(directory).exists())

    def test_env_file_and_environment_precedence(self):
        with TemporaryDirectory() as directory, patch.dict(os.environ, {"LOONG_PORT": "9000"}, clear=True):
            path = Path(directory) / ".env.local"
            path.write_text("LOONG_PORT=8000\nDB_POOL_SIZE=3\nDATABASE_URL=sqlite:///demo.db", encoding="utf-8")
            config = loading_config(path)
            self.assertEqual(config["LOONG_PORT"], "9000")
            self.assertEqual(config["DB_POOL_SIZE"], "3")
            self.assertNotIn("DB_POOL_SIZE", os.environ)

    @unittest.skipUnless(importlib.util.find_spec("yaml"), "尚未安装 PyYAML")
    def test_yaml(self):
        with TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            for suffix in ("yaml", "yml"):
                path = Path(directory) / f"config.{suffix}"
                path.write_text("DB_POOL_PRE_PING: false\nLOONG_AUTH_PUBLIC_PATHS:\n  - /api/status\n",
                                encoding="utf-8")
                config = loading_config(path)
                self.assertFalse(config["DB_POOL_PRE_PING"])
                self.assertEqual(config["LOONG_AUTH_PUBLIC_PATHS"], ["/api/status"])
                path.write_text("- invalid", encoding="utf-8")
                with self.assertRaises(ValueError):
                    loading_config(path)

    @unittest.skipUnless(importlib.util.find_spec("yaml"), "尚未安装 PyYAML")
    def test_yaml_returns_global_config(self):
        content = """log_level: DEBUG
white_list_urls:
  - /api/status
db_config:
  db_type: mysql
  pool:
    size: 8
    pre_ping: false
"""
        with TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            for suffix in ("yaml", "yml"):
                with self.subTest(suffix=suffix):
                    path = Path(directory) / f"config.{suffix}"
                    path.write_text(content, encoding="utf-8")
                    config = GlobalConfig.load(path)
                    self.assertIsInstance(config, GlobalConfig)
                    self.assertEqual(config.log_level, "DEBUG")
                    self.assertEqual(config.white_list_urls, ["/api/status"])
                    self.assertEqual(config.db_config.db_type, "mysql")
                    self.assertEqual(config.db_config.pool.size, 8)
                    self.assertFalse(config.db_config.pool.pre_ping)
                    self.assertEqual(config.db_config.pool.timeout, 30)

    @unittest.skipUnless(importlib.util.find_spec("yaml"), "尚未安装 PyYAML")
    def test_yaml_environment_overrides_preserve_other_fields(self):
        content = """log_level: INFO
db_config:
  db_type: mysql
  pool:
    size: 8
    timeout: 12
LOONG_LOG_LEVEL: WARNING
LOONG_DB_CONFIG__POOL__SIZE: 9
"""
        with TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            path = Path(directory) / "config.yaml"
            path.write_text(content, encoding="utf-8")
            file_config = load_global_config(path)
            self.assertEqual(file_config.log_level, "WARNING")
            self.assertEqual(file_config.db_config.pool.size, 9)
            with patch.dict(os.environ, {
                "LOONG_LOG_LEVEL": "ERROR",
                "LOONG_DB_CONFIG__POOL": '{"size":10,"pre_ping":false}',
                "LOONG_DB_CONFIG__POOL__SIZE": "11",
                "LOONG_WHITE_LIST_URLS": '["/api/demo"]',
                "UNRELATED_SETTING": "ignored",
            }):
                config = load_global_config(path)
            self.assertEqual(config.log_level, "ERROR")
            self.assertEqual(config.white_list_urls, ["/api/demo"])
            self.assertEqual(config.db_config.db_type, "mysql")
            self.assertEqual(config.db_config.pool.size, 11)
            self.assertEqual(config.db_config.pool.timeout, 12)
            self.assertFalse(config.db_config.pool.pre_ping)

    @unittest.skipUnless(importlib.util.find_spec("yaml"), "尚未安装 PyYAML")
    def test_yaml_defaults_and_validation(self):
        with TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            path = Path(directory) / "config.yaml"
            path.write_text("", encoding="utf-8")
            self.assertEqual(load_global_config(path), GlobalConfig())
            for content in ("unknown_field: true", "log_level: INVALID", "db_config:\n  pool:\n    size: 0"):
                with self.subTest(content=content):
                    path.write_text(content, encoding="utf-8")
                    with self.assertRaises(ValidationError):
                        load_global_config(path)
            path.write_text("log_level: [", encoding="utf-8")
            import yaml

            with self.assertRaises(yaml.YAMLError):
                load_global_config(path)

    def test_environment_and_invalid_paths(self):
        with patch.dict(os.environ, {"LOONG_PORT": "9000"}, clear=True):
            self.assertEqual(loading_config(), {"LOONG_PORT": "9000"})
        with TemporaryDirectory() as directory:
            path = Path(directory) / "config.json"
            with self.assertRaises(FileNotFoundError):
                loading_config(path)
            path.write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError):
                loading_config(path)
