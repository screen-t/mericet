from fastapi import APIRouter, HTTPException, Depends, Query
from app.middleware.auth import require_auth
from app.deps import get_connection_repo, get_user_repo
from app.models.connection import ConnectionRequest, ConnectionUpdate, ConnectionResponse
from typing import List

router = APIRouter(prefix="/connections", tags=["Connections"])

USER_FIELDS = "id, username, first_name, last_name, avatar_url, headline, current_position, current_company"


def _enrich_connection(conn: dict, user_repo, current_user_id: str = None):
    try:
        requester = user_repo.get_by_id(conn["requester_id"], USER_FIELDS)
        receiver = user_repo.get_by_id(conn["receiver_id"], USER_FIELDS)
        conn["requester"] = requester
        conn["receiver"] = receiver
        if current_user_id:
            conn["user"] = receiver if conn["requester_id"] == current_user_id else requester
        else:
            conn["user"] = requester
        return conn
    except Exception as e:
        print(f"Error enriching connection: {e}")
        return conn


@router.post("")
def send_connection_request(
    payload: ConnectionRequest,
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    user_repo=Depends(get_user_repo),
):
    existing = conn_repo.get_between(user_id, payload.receiver_id)
    if existing:
        raise HTTPException(status_code=409, detail="Connection request already exists")
    data = {"requester_id": user_id, "receiver_id": payload.receiver_id, "status": "pending"}
    created = conn_repo.create(data)
    from app.routes.notifications import create_notification
    create_notification(
        user_id=payload.receiver_id,
        notification_type="connection_request",
        message="sent you a connection request",
        actor_id=user_id,
        connection_id=created.get("id"),
    )
    return {"message": "Connection request sent", "data": _enrich_connection(created, user_repo)}


@router.get("", response_model=List[ConnectionResponse])
def get_connections(
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    user_repo=Depends(get_user_repo),
    status: str = Query("accepted", pattern="^(pending|accepted|declined|blocked)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    connections = conn_repo.get_for_user(user_id, status, limit, offset)
    return [_enrich_connection(c, user_repo, user_id) for c in connections]


@router.get("/requests", response_model=List[ConnectionResponse])
def get_connection_requests(
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    user_repo=Depends(get_user_repo),
):
    requests = conn_repo.get_pending_received(user_id)
    return [_enrich_connection(r, user_repo, user_id) for r in requests]


@router.get("/sent", response_model=List[ConnectionResponse])
def get_sent_requests(
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    user_repo=Depends(get_user_repo),
):
    requests = conn_repo.get_pending_sent(user_id)
    return [_enrich_connection(r, user_repo) for r in requests]


@router.put("/{connection_id}")
def update_connection(
    connection_id: str,
    payload: ConnectionUpdate,
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    user_repo=Depends(get_user_repo),
):
    connection = conn_repo.get_by_id(connection_id)
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    if connection["receiver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Only the receiver can update this request")
    updated = conn_repo.update(connection_id, {"status": payload.status.value, "updated_at": "now()"})
    if payload.status.value == "accepted":
        from app.routes.notifications import create_notification
        create_notification(
            user_id=connection["requester_id"],
            notification_type="connection_accepted",
            message="accepted your connection request",
            actor_id=user_id,
            connection_id=connection_id,
        )
    return {"message": f"Connection {payload.status.value}", "data": _enrich_connection(updated, user_repo)}


@router.delete("/{connection_id}")
def delete_connection(
    connection_id: str,
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
):
    connection = conn_repo.get_by_id(connection_id)
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    if connection["requester_id"] != user_id and connection["receiver_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    conn_repo.delete(connection_id)
    return {"message": "Connection removed"}


@router.get("/check/by-id/{other_user_id}")
def check_connection_status_by_id(
    other_user_id: str,
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
):
    conn = conn_repo.get_between(user_id, other_user_id)
    if not conn:
        return {"status": "none", "can_connect": True}
    is_requester = conn["requester_id"] == user_id
    status = conn["status"]
    if status == "pending" and not is_requester:
        status = "pending_from_them"
    return {"status": status, "connection_id": conn["id"], "is_requester": is_requester, "can_connect": False}


@router.get("/check/{username}")
def check_connection_status(
    username: str,
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    user_repo=Depends(get_user_repo),
):
    user = user_repo.get_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    other_user_id = user["id"]
    conn = conn_repo.get_between(user_id, other_user_id)
    if not conn:
        return {"status": "none", "can_connect": True}
    return {"status": conn["status"], "connection_id": conn["id"],
            "is_requester": conn["requester_id"] == user_id, "can_connect": False}


@router.get("/mutual/{username}")
def get_mutual_connections(
    username: str,
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    user_repo=Depends(get_user_repo),
):
    user = user_repo.get_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    other_user_id = user["id"]
    my_ids = set(conn_repo.get_connected_ids(user_id))
    their_ids = set(conn_repo.get_connected_ids(other_user_id))
    mutual_ids = my_ids & their_ids
    if not mutual_ids:
        return {"count": 0, "connections": []}
    mutual_users = user_repo.get_many_by_ids(list(mutual_ids), "id, username, first_name, last_name, avatar_url, headline")
    return {"count": len(mutual_ids), "connections": mutual_users}


@router.get("/suggestions")
def get_connection_suggestions(
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    limit: int = Query(10, ge=1, le=50),
):
    excluded = conn_repo.get_excluded_ids(user_id)
    suggestions = conn_repo.get_suggestions(user_id, list(excluded), limit)
    return {"suggestions": suggestions}


@router.post("/block/{other_user_id}")
def block_user(
    other_user_id: str,
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
    user_repo=Depends(get_user_repo),
):
    if other_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    if conn_repo.is_blocked(user_id, other_user_id):
        return {"message": "User already blocked"}
    conn_repo.delete_between(user_id, other_user_id)
    row = conn_repo.create({"requester_id": user_id, "receiver_id": other_user_id, "status": "blocked"})
    return {"message": "User blocked", "data": _enrich_connection(row, user_repo, user_id)}


@router.post("/unblock/{other_user_id}")
def unblock_user(
    other_user_id: str,
    user_id: str = Depends(require_auth),
    conn_repo=Depends(get_connection_repo),
):
    if not conn_repo.is_blocked(user_id, other_user_id):
        return {"message": "User already unblocked"}
    conn_repo.delete_between(user_id, other_user_id)
    return {"message": "User unblocked"}
