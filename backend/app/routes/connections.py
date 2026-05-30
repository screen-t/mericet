from fastapi import APIRouter, HTTPException, Depends, Query
from app.lib.supabase import supabase
from app.middleware.auth import require_auth
from app.models.connection import ConnectionRequest, ConnectionUpdate, ConnectionResponse
from typing import List

router = APIRouter(prefix="/connections", tags=["Connections"])

def enrich_connection(conn: dict, current_user_id: str = None):
    """Enrich connection with user info"""
    try:
        # Get requester info
        requester = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline, current_position, current_company").eq("id", conn["requester_id"]).single().execute()
        conn["requester"] = requester.data if requester.data else None
        
        # Get receiver info
        receiver = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline, current_position, current_company").eq("id", conn["receiver_id"]).single().execute()
        conn["receiver"] = receiver.data if receiver.data else None

        # Set "user" to the other person (not the current user)
        if current_user_id:
            conn["user"] = conn["receiver"] if conn["requester_id"] == current_user_id else conn["requester"]
        else:
            conn["user"] = conn["requester"]
        
        return conn
    except Exception as e:
        print(f"Error enriching connection: {e}")
        return conn

@router.post("")
def send_connection_request(payload: ConnectionRequest, user_id: str = Depends(require_auth)):
    """Send a connection request"""
    try:
        # Check if request already exists
        existing = supabase.table("connections").select("*").or_(
            f"and(requester_id.eq.{user_id},receiver_id.eq.{payload.receiver_id}),and(requester_id.eq.{payload.receiver_id},receiver_id.eq.{user_id})"
        ).execute()
        
        if existing.data:
            raise HTTPException(status_code=409, detail="Connection request already exists")
        
        # Create connection request
        data = {
            "requester_id": user_id,
            "receiver_id": payload.receiver_id,
            "status": "pending"
        }
        
        response = supabase.table("connections").insert(data).execute()
        enriched = enrich_connection(response.data[0])
        
        # TODO: Create notification for receiver
        
        return {"message": "Connection request sent", "data": enriched}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("", response_model=List[ConnectionResponse])
def get_connections(
    user_id: str = Depends(require_auth),
    status: str = Query("accepted", pattern="^(pending|accepted|declined|blocked)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get user's connections by status"""
    try:
        # Get connections where user is requester or receiver
        connections = supabase.table("connections").select("*").or_(
            f"requester_id.eq.{user_id},receiver_id.eq.{user_id}"
        ).eq("status", status).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        
        enriched = [enrich_connection(conn, user_id) for conn in connections.data]
        return enriched
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/requests", response_model=List[ConnectionResponse])
def get_connection_requests(user_id: str = Depends(require_auth)):
    """Get pending connection requests received by the user"""
    try:
        requests = supabase.table("connections").select("*").eq("receiver_id", user_id).eq("status", "pending").order("created_at", desc=True).execute()
        
        enriched = [enrich_connection(req, user_id) for req in requests.data]
        return enriched
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/sent", response_model=List[ConnectionResponse])
def get_sent_requests(user_id: str = Depends(require_auth)):
    """Get connection requests sent by the user"""
    try:
        requests = supabase.table("connections").select("*").eq("requester_id", user_id).eq("status", "pending").order("created_at", desc=True).execute()
        
        enriched = [enrich_connection(req) for req in requests.data]
        return enriched
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{connection_id}")
def update_connection(connection_id: str, payload: ConnectionUpdate, user_id: str = Depends(require_auth)):
    """Accept or decline a connection request"""
    try:
        # Get connection
        connection = supabase.table("connections").select("*").eq("id", connection_id).single().execute()
        
        if not connection.data:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # Only receiver can accept/decline
        if connection.data["receiver_id"] != user_id:
            raise HTTPException(status_code=403, detail="Only the receiver can update this request")
        
        # Update status
        update_data = {
            "status": payload.status.value,
            "updated_at": "now()"
        }
        
        response = supabase.table("connections").update(update_data).eq("id", connection_id).execute()
        enriched = enrich_connection(response.data[0])
        
        # TODO: Create notification for requester
        
        return {"message": f"Connection {payload.status.value}", "data": enriched}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{connection_id}")
def delete_connection(connection_id: str, user_id: str = Depends(require_auth)):
    """Remove a connection or cancel a request"""
    try:
        # Get connection
        connection = supabase.table("connections").select("*").eq("id", connection_id).single().execute()
        
        if not connection.data:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        # User must be either requester or receiver
        if connection.data["requester_id"] != user_id and connection.data["receiver_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        supabase.table("connections").delete().eq("id", connection_id).execute()
        
        return {"message": "Connection removed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/check/by-id/{other_user_id}")
def check_connection_status_by_id(other_user_id: str, user_id: str = Depends(require_auth)):
    """Check connection status with a specific user by their ID"""
    try:
        connection = supabase.table("connections").select("*").or_(
            f"and(requester_id.eq.{user_id},receiver_id.eq.{other_user_id}),and(requester_id.eq.{other_user_id},receiver_id.eq.{user_id})"
        ).execute()

        if not connection.data:
            return {"status": "none", "can_connect": True}

        conn = connection.data[0]
        is_requester = conn["requester_id"] == user_id
        status = conn["status"]

        # If pending and they sent to me, flag it as pending_from_them
        if status == "pending" and not is_requester:
            status = "pending_from_them"

        return {
            "status": status,
            "connection_id": conn["id"],
            "is_requester": is_requester,
            "can_connect": False
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/check/{username}")
def check_connection_status(username: str, user_id: str = Depends(require_auth)):
    """Check connection status with a specific user"""
    try:
        # Get user ID from username
        user = supabase.table("users").select("id").eq("username", username).single().execute()
        if not user.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        other_user_id = user.data["id"]
        
        # Check if connection exists
        connection = supabase.table("connections").select("*").or_(
            f"and(requester_id.eq.{user_id},receiver_id.eq.{other_user_id}),and(requester_id.eq.{other_user_id},receiver_id.eq.{user_id})"
        ).execute()
        
        if not connection.data:
            return {"status": "none", "can_connect": True}
        
        conn = connection.data[0]
        return {
            "status": conn["status"],
            "connection_id": conn["id"],
            "is_requester": conn["requester_id"] == user_id,
            "can_connect": False
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/mutual/{username}")
def get_mutual_connections(username: str, user_id: str = Depends(require_auth)):
    """Get mutual connections with another user"""
    try:
        # Get other user ID
        user = supabase.table("users").select("id").eq("username", username).single().execute()
        if not user.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        other_user_id = user.data["id"]
        
        # Get current user's connections
        my_connections = supabase.table("connections").select("requester_id, receiver_id").or_(
            f"requester_id.eq.{user_id},receiver_id.eq.{user_id}"
        ).eq("status", "accepted").execute()
        
        my_connected_ids = set()
        for conn in my_connections.data:
            if conn["requester_id"] == user_id:
                my_connected_ids.add(conn["receiver_id"])
            else:
                my_connected_ids.add(conn["requester_id"])
        
        # Get other user's connections
        their_connections = supabase.table("connections").select("requester_id, receiver_id").or_(
            f"requester_id.eq.{other_user_id},receiver_id.eq.{other_user_id}"
        ).eq("status", "accepted").execute()
        
        their_connected_ids = set()
        for conn in their_connections.data:
            if conn["requester_id"] == other_user_id:
                their_connected_ids.add(conn["receiver_id"])
            else:
                their_connected_ids.add(conn["requester_id"])
        
        # Find mutual connections
        mutual_ids = my_connected_ids.intersection(their_connected_ids)
        
        if not mutual_ids:
            return {"count": 0, "connections": []}
        
        # Get user details for mutual connections
        mutual_users = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline").in_("id", list(mutual_ids)).execute()
        
        return {"count": len(mutual_ids), "connections": mutual_users.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/suggestions")
def get_connection_suggestions(user_id: str = Depends(require_auth), limit: int = Query(10, ge=1, le=50)):
    """Get suggested connections (users not yet connected)"""
    try:
        # Get users already connected or requested
        my_connections = supabase.table("connections").select("requester_id, receiver_id").or_(
            f"requester_id.eq.{user_id},receiver_id.eq.{user_id}"
        ).execute()
        
        excluded_ids = {user_id}  # Include self
        for conn in my_connections.data:
            excluded_ids.add(conn["requester_id"])
            excluded_ids.add(conn["receiver_id"])
        
        # Get suggested users (simple: just users not connected)
        # TODO: Implement better algorithm based on mutual connections, industry, etc.
        suggestions = supabase.table("users").select("id, username, first_name, last_name, avatar_url, headline, current_position, current_company, industry").not_.in_("id", list(excluded_ids)).eq("is_active", True).limit(limit).execute()
        
        return {"suggestions": suggestions.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/block/{other_user_id}")
def block_user(other_user_id: str, user_id: str = Depends(require_auth)):
    """Block another user. This creates or replaces any existing connection row with status 'blocked'."""
    try:
        if other_user_id == user_id:
            raise HTTPException(status_code=400, detail="Cannot block yourself")

        # Remove any existing connection rows between these users
        supabase.table("connections").delete().or_(
            f"and(requester_id.eq.{user_id},receiver_id.eq.{other_user_id}),and(requester_id.eq.{other_user_id},receiver_id.eq.{user_id})"
        ).execute()

        # Insert blocked row with current user as requester
        row = {
            "requester_id": user_id,
            "receiver_id": other_user_id,
            "status": "blocked"
        }
        resp = supabase.table("connections").insert(row).execute()
        enriched = enrich_connection(resp.data[0], user_id)
        return {"message": "User blocked", "data": enriched}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/unblock/{other_user_id}")
def unblock_user(other_user_id: str, user_id: str = Depends(require_auth)):
    """Unblock a previously blocked user (only removes blocks created by the current user)."""
    try:
        # Delete block rows where current user was the requester (blocker)
        supabase.table("connections").delete().eq("requester_id", user_id).eq("receiver_id", other_user_id).eq("status", "blocked").execute()
        return {"message": "User unblocked"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
