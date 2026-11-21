from uuid import uuid4


def identifier() -> str:
    return uuid4().hex


def uuid_str() -> str:
    return str(uuid4())
