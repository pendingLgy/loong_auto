from dataclasses import dataclass

from sqlalchemy import MetaData, Table

from loong_cloud.schema.user import user_table, login_log_table
from loong_cloud.schema.message import message_table, session_message_table

@dataclass(frozen=True)
class Tables:
    user: Table
    login_log: Table
    message: Table
    session_message: Table


GLOBAL_TABLE_METADATA: MetaData = MetaData()
GLOBAL_TABLES: Tables | None = None


def load_tables(prefix: str):
    global GLOBAL_TABLES

    if GLOBAL_TABLES is None:

        GLOBAL_TABLES = Tables(
            user=user_table(GLOBAL_TABLE_METADATA, prefix),
            login_log=login_log_table(GLOBAL_TABLE_METADATA, prefix),
            message=message_table(GLOBAL_TABLE_METADATA, prefix),
            session_message=session_message_table(GLOBAL_TABLE_METADATA, prefix),
        )


__ALL__ = ["load_tables","GLOBAL_TABLE_METADATA","GLOBAL_TABLES"]
