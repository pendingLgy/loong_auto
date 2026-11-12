from sqlalchemy import MetaData

from loong_cloud.schema.user import user_table, login_log_table


def load_tables(prefix: str) -> MetaData:
    table_metadata = MetaData()
    user_table(table_metadata, prefix)
    login_log_table(table_metadata, prefix)

    return table_metadata

__ALL__ = ["load_tables"]
