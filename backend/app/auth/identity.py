"""Identity dependency.

Reads forwarded authentication headers injected by oauth2-proxy / ingress.
The concrete auth enforcement layer is deferred until the Azure landing zone
is provisioned. Read-path routes do not consume identity today, but the
dependency exists so write-path routes can attach it without changes.
"""

from dataclasses import dataclass

from fastapi import Request


@dataclass(frozen=True)
class Identity:
    email: str | None
    subject_id: str | None


def current_identity(request: Request) -> Identity:
    """Extract the caller's identity from oauth2-proxy forwarded headers.

    Returns an anonymous Identity (all fields None) when no headers are
    present, e.g. during local development or in tests that don't set them.
    """
    return Identity(
        email=request.headers.get("X-Forwarded-Email"),
        subject_id=request.headers.get("X-Forwarded-User"),
    )
