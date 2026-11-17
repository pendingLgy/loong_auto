from dataclasses import dataclass

from sqlalchemy import MetaData, Table

from loong_local.schema.tables import get_gateway_table, get_tool_batch_table, get_tool_approval_table, \
    get_tool_execution_table, get_cloud_submission_table, get_sse_event_table


@dataclass(frozen=True)
class Tables:
    gateway: Table
    tool_batch: Table
    tool_approval: Table
    tool_execution: Table
    cloud_submission: Table
    sse_event: Table


GLOBAL_TABLE_METADATA: MetaData = MetaData()
GLOBAL_TABLES: Tables | None = None


def load_tables(prefix: str):
    global GLOBAL_TABLES

    if GLOBAL_TABLES is None:

        GLOBAL_TABLES = Tables(
            gateway=get_gateway_table(GLOBAL_TABLE_METADATA, prefix),
            tool_batch=get_tool_batch_table(GLOBAL_TABLE_METADATA, prefix),
            tool_approval=get_tool_approval_table(GLOBAL_TABLE_METADATA, prefix),
            tool_execution=get_tool_execution_table(GLOBAL_TABLE_METADATA, prefix),
            cloud_submission=get_cloud_submission_table(GLOBAL_TABLE_METADATA, prefix),
            sse_event=get_sse_event_table(GLOBAL_TABLE_METADATA, prefix),
        )


