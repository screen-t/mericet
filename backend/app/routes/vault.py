from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import List, Optional, Dict, Any
from app.middleware.auth import require_auth, optional_auth
from app.deps import get_vault_repo, get_connected_tool_repo, get_living_graph_repo
from app.models.vault import (
    VaultItemCreate, VaultItemUpdate, VaultItemResponse,
    ConnectedToolCreate, ConnectedToolResponse, VerifyVaultItemRequest,
    VerificationTier, VaultCategory, LivingGraphSyncSummary, LivingGraphRunResponse
)
from app.services.verification_service import VerificationService
from app.services.living_graph import LivingGraphEngine

router = APIRouter(prefix="/vault", tags=["Vault"])


# ==================== VAULT CRUD ====================

@router.get("", response_model=List[VaultItemResponse])
def get_my_vault_items(
    category: Optional[VaultCategory] = None,
    limit: int = Query(50, ge=1, le=100, description="Page size limit (1-100)"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    user_id: str = Depends(require_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Retrieve all vault items for the authenticated user with bounded pagination."""
    cat_val = category.value if category else None
    items = vault_repo.get_by_user(
        user_id=user_id,
        category=cat_val,
        is_public_only=False,
        limit=limit,
        offset=offset,
    )
    return items


@router.post("", response_model=VaultItemResponse)
def create_vault_item(
    payload: VaultItemCreate,
    user_id: str = Depends(require_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Create a new vault item for the authenticated user.
    
    SECURITY INVARIANTS:
    - Server-side ownership enforced: item is bound to authenticated user_id.
    - Raw verification documents must NOT be uploaded.
    - Client-supplied verification tiers or scores are rejected (prevent mass assignment).
    """
    data = payload.model_dump(exclude_unset=True)
    # Server-controlled fields
    data["user_id"] = user_id
    if isinstance(data.get("category"), VaultCategory):
        data["category"] = data["category"].value

    # Evaluate initial tier: Local Poseidon commitment is Weak (Bronze); otherwise default is None
    if data.get("poseidon_hash"):
        data["verification_tier"] = VerificationTier.weak.value
        data["verification_metadata"] = {
            "commitment_type": "poseidon_hash",
            "poseidon_hash": data["poseidon_hash"],
            "registered_at": "now()",
            "verifier": "Client-Poseidon-Commitment",
        }
    else:
        data["verification_tier"] = VerificationTier.none.value
        data["verification_metadata"] = {}

    created = vault_repo.create(data)
    return created


@router.get("/user/{target_user_id}", response_model=List[VaultItemResponse])
def get_user_vault_items(
    target_user_id: str,
    category: Optional[VaultCategory] = None,
    limit: int = Query(50, ge=1, le=100, description="Page size limit (1-100)"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    viewer_id: Optional[str] = Depends(optional_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Get vault items for a user. Public items only unless viewed by the owner."""
    is_owner = (viewer_id is not None and viewer_id == target_user_id)
    cat_val = category.value if category else None
    items = vault_repo.get_by_user(
        user_id=target_user_id,
        category=cat_val,
        is_public_only=not is_owner,
        limit=limit,
        offset=offset,
    )
    return items


@router.get("/{item_id}", response_model=VaultItemResponse)
def get_vault_item(
    item_id: str,
    viewer_id: Optional[str] = Depends(optional_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Get a single vault item with strict privacy check."""
    item = vault_repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Vault item not found")
    
    # Privacy authorization check: private items are only viewable by owner
    if not item.get("is_public", True) and item.get("user_id") != viewer_id:
        raise HTTPException(status_code=403, detail="This vault item is private")

    return item


@router.put("/{item_id}", response_model=VaultItemResponse)
def update_vault_item(
    item_id: str,
    payload: VaultItemUpdate,
    user_id: str = Depends(require_auth),
    vault_repo=Depends(get_vault_repo),
):
    current_item = vault_repo.get_by_id(item_id)
    if not current_item:
        raise HTTPException(status_code=404, detail="Vault item not found")
    if current_item.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to modify this vault item")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Defense in depth: forbid modifying system-managed attributes
    for forbidden in ("id", "user_id", "created_at", "verification_tier", "verification_metadata"):
        update_data.pop(forbidden, None)

    if isinstance(update_data.get("category"), VaultCategory):
        update_data["category"] = update_data["category"].value

    # Trust-tier hijacking prevention:
    # If claim title or category changed on a verified item (Mid/Silver or Strong/Gold),
    # invalidate the trust tier back to unverified/weak pending re-verification.
    title_changed = "title" in update_data and update_data["title"] != current_item.get("title")
    category_changed = "category" in update_data and update_data["category"] != current_item.get("category")
    if (title_changed or category_changed) and current_item.get("verification_tier") in (VerificationTier.mid.value, VerificationTier.strong.value):
        effective_hash = update_data.get("poseidon_hash") or current_item.get("poseidon_hash")
        update_data["verification_tier"] = VerificationTier.weak.value if effective_hash else VerificationTier.none.value
        update_data["verification_metadata"] = {
            "reverification_required": True,
            "reason": "Claim title or category was modified after verification.",
            "invalidated_at": "now()",
        }

    # If poseidon_hash is updated, update commitment metadata
    if "poseidon_hash" in update_data:
        if update_data["poseidon_hash"]:
            update_data["verification_tier"] = VerificationTier.weak.value
            update_data["verification_metadata"] = {
                "commitment_type": "poseidon_hash",
                "poseidon_hash": update_data["poseidon_hash"],
                "updated_at": "now()",
            }
        else:
            update_data["verification_tier"] = VerificationTier.none.value

    updated = vault_repo.update(item_id, update_data)
    return updated


@router.delete("/{item_id}")
def delete_vault_item(
    item_id: str,
    user_id: str = Depends(require_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Delete a vault item (enforces server-side ownership)."""
    owner_id = vault_repo.get_owner(item_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Vault item not found")
    if owner_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to delete this vault item")

    vault_repo.delete(item_id)
    return {"message": "Vault item deleted successfully", "id": item_id}


# ==================== VERIFICATION PIPELINE (Issue #58 3-Tier Policy) ====================

@router.post("/{item_id}/verify")
def verify_vault_item(
    item_id: str,
    payload: VerifyVaultItemRequest,
    user_id: str = Depends(require_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Evaluate submitted proof evidence and assign Trust Tier automatically without human intervention.
    
    Tiers assigned per Issue #58 policy:
    - Weak (Bronze): URL or claim exists, but evidence is insufficient, generic, or partially relevant.
    - Mid (Silver): Verified text relevance exceeds 85% (>0.85) OR approved via P2P ring signatures.
    - Strong (Gold): TLSNotary verified API stats OR vector analysis confirms codebase originality.
    - None (Unverified): Invalid, forged, or unverifiable claims (fail-closed).
    """
    item = vault_repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Vault item not found")
    if item.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to verify this vault item")

    stored_hash = item.get("poseidon_hash")
    result = VerificationService.evaluate(
        proof_type=payload.proof_type,
        evidence=payload.evidence,
        stored_poseidon_hash=stored_hash,
        item_title=item.get("title", ""),
        item_category=item.get("category", ""),
    )

    # Persist updated tier and explicit audit metadata
    update_data = {
        "verification_tier": result.tier.value,
        "verification_metadata": {
            "verified": result.verified,
            "message": result.message,
            "details": result.details,
            "proof_type": payload.proof_type,
            "evaluated_at": "now()",
        }
    }
    updated_item = vault_repo.update(item_id, update_data)
    
    return {
        "item_id": item_id,
        "verification": result.to_dict(),
        "item": updated_item,
    }


# ==================== CONNECTED TOOLS & LIVING GRAPH (Issue #60) ====================

@router.get("/tools/list", response_model=List[ConnectedToolResponse])
def get_connected_tools(
    user_id: str = Depends(require_auth),
    tool_repo=Depends(get_connected_tool_repo),
):
    """Get all connected tools for the authenticated user."""
    return tool_repo.get_by_user(user_id)


@router.post("/tools", response_model=ConnectedToolResponse)
def connect_tool(
    payload: ConnectedToolCreate,
    user_id: str = Depends(require_auth),
    tool_repo=Depends(get_connected_tool_repo),
):
    """Connect or update an external tool (GitHub, LeetCode, Credly) for Living Graph automation.
    
    SECURITY: No private credentials or passwords stored.
    """
    data = {
        "user_id": user_id,
        "provider": payload.provider,
        "handle": payload.handle,
        "auth_status": "connected",
        "metadata": {},
    }
    tool = tool_repo.upsert(data)
    return tool


@router.delete("/tools/{tool_id}")
def disconnect_tool(
    tool_id: str,
    user_id: str = Depends(require_auth),
    tool_repo=Depends(get_connected_tool_repo),
):
    """Disconnect a connected tool and stop future collection."""
    owner_id = tool_repo.get_owner(tool_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Connected tool not found")
    if owner_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to remove this connected tool")

    tool_repo.delete(tool_id)
    return {"message": "Tool disconnected successfully", "id": tool_id}


@router.post("/living-graph/sync", response_model=Dict[str, Any])
def sync_living_graph(
    user_id: str = Depends(require_auth),
    tool_repo=Depends(get_connected_tool_repo),
    vault_repo=Depends(get_vault_repo),
):
    """Trigger Living Graph synchronization for the authenticated user."""
    sync_result = LivingGraphEngine.sync_user_tools(user_id, tool_repo, vault_repo)
    return {
        "message": "Living graph synchronized successfully",
        "result": sync_result,
    }


@router.get("/living-graph/runs", response_model=List[LivingGraphRunResponse])
def get_living_graph_runs(
    limit: int = Query(20, ge=1, le=100),
    user_id: str = Depends(require_auth),
    living_graph_repo=Depends(get_living_graph_repo),
):
    """Observability endpoint: retrieve recent worker execution audit logs."""
    return living_graph_repo.get_recent_sync_runs(limit=limit)
