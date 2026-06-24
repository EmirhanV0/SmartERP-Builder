"""
Request Timing Middleware — measures each request's elapsed time.
The last 5 minutes of durations are kept in an in-memory deque (max 1000 entries).
"""
import time
from collections import deque
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

# Thread-safe deque: (timestamp_utc, elapsed_ms) pairs
_request_log: deque[tuple[float, float]] = deque(maxlen=1000)

WINDOW_SECONDS = 300  # 5 minutes


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """Appends the duration of each HTTP request to _request_log."""

    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        elapsed_ms = (time.monotonic() - start) * 1000.0
        _request_log.append((time.time(), elapsed_ms))
        return response


def _recent_durations() -> list[float]:
    """Returns request durations within the last 5 minutes."""
    cutoff = time.time() - WINDOW_SECONDS
    return [ms for ts, ms in _request_log if ts >= cutoff]


def get_p95() -> float:
    """95th percentile (ms) of request durations in the last 5 minutes. Returns 0 if no data."""
    durations = _recent_durations()
    if not durations:
        return 0.0
    sorted_d = sorted(durations)
    n = len(sorted_d)
    # Nearest-rank method
    idx = max(0, int(0.95 * n) - 1)
    return round(sorted_d[idx], 1)


def get_request_count_5m() -> int:
    """Total number of requests in the last 5 minutes."""
    return len(_recent_durations())
