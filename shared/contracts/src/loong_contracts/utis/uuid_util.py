from uuid import uuid4


def identifier() -> str:
    return uuid4().hex