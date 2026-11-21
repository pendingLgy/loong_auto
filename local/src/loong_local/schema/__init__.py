from dataclasses import dataclass

from sqlalchemy import MetaData, Table

from loong_local.schema.tables import (
    get_session_configs_table,
    get_supplier_config_table,
    get_supplier_model_option_table,
    get_tool_tasks_table,
)


@dataclass(frozen=True)
class Tables:
    pending_tool_tasks_table: Table
    session_configs_table: Table
    supplier_config_table: Table
    supplier_model_option_table: Table


GLOBAL_TABLE_METADATA: MetaData = MetaData()
GLOBAL_TABLES: Tables | None = None


def load_tables(prefix: str):
    global GLOBAL_TABLES

    if GLOBAL_TABLES is None:
        GLOBAL_TABLES = Tables(
            pending_tool_tasks_table=get_tool_tasks_table(GLOBAL_TABLE_METADATA, prefix),
            session_configs_table=get_session_configs_table(GLOBAL_TABLE_METADATA, prefix),
            supplier_config_table=get_supplier_config_table(GLOBAL_TABLE_METADATA, prefix),
            supplier_model_option_table=get_supplier_model_option_table(GLOBAL_TABLE_METADATA, prefix),
        )



__ALL__ = ["load_tables","GLOBAL_TABLE_METADATA","GLOBAL_TABLES"]
