from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request

limiter = Limiter(key_func=get_remote_address)


def get_user_or_ip(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return str(user_id)
    return get_remote_address(request)


AUTH_LIMIT = "10/minute"
WRITE_LIMIT = "30/minute"
READ_LIMIT = "60/minute"
SEARCH_LIMIT = "20/minute"
UPLOAD_LIMIT = "10/minute"
