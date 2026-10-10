from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from app.middleware.auth import require_auth, optional_auth
from app.deps import get_vault_repo, get_connected_tool_repo
from app.models.vault import (
    VaultItemCreate, VaultItemUpdate, VaultItemResponse,
    ConnectedToolCreate, ConnectedToolResponse, VerifyVaultItemRequest,
    VerificationTier
)
from app.services.verification_service import VerificationService
from app.services.living_graph import LivingGraphEngine

router = APIRouter(prefix="/vault", tags=["Vault"])


# ==================== VAULT CRUD ====================

@router.get("", response_model=List[VaultItemResponse])
def get_my_vault_items(
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    user_id: str = Depends(require_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Retrieve all vault items for the authenticated user."""
    items = vault_repo.get_by_user(user_id=user_id, category=category, is_public_only=False, limit=limit, offset=offset)
    return items


@router.post("", response_model=VaultItemResponse)
def create_vault_item(
    payload: VaultItemCreate,
    user_id: str = Depends(require_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Create a new vault item for the authenticated user.
    
    SECURITY: Raw verification documents must NOT be uploaded.
    Client supplies only client-computed Poseidon commitment hash if available.
    """
    data = payload.model_dump(exclude_unset=True)
    data["user_id"] = user_id
    
    # If a Poseidon commitment is provided, initialize verification metadata accordingly
    if data.get("poseidon_hash"):
        data["verification_tier"] = VerificationTier.weak.value
        data["verification_metadata"] = {
            "commitment_type": "poseidon_hash",
            "poseidon_hash": data["poseidon_hash"],
            "registered_at": "now()",
        }
    else:
        data["verification_tier"] = VerificationTier.none.value
        data["verification_metadata"] = {}

    created = vault_repo.create(data)
    return created


@router.get("/user/{target_user_id}", response_model=List[VaultItemResponse])
def get_user_vault_items(
    target_user_id: str,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    viewer_id: Optional[str] = Depends(optional_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Get vault items for a user. Public items only unless viewed by the owner."""
    is_owner = viewer_id == target_user_id
    items = vault_repo.get_by_user(
        user_id=target_user_id,
        category=category,
        is_public_only=not is_owner,
        limit=limit,
        offset=offset
    )
    return items


@router.get("/{item_id}", response_model=VaultItemResponse)
def get_vault_item(
    item_id: str,
    viewer_id: Optional[str] = Depends(optional_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Get a single vault item."""
    item = vault_repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Vault item not found")
    
    # Privacy check
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
    """Update a vault item (enforces ownership)."""
    owner_id = vault_repo.get_owner(item_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Vault item not found")
    if owner_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to modify this vault item")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If poseidon_hash is updated, update verification tier commitment
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
    """Delete a vault item (enforces ownership)."""
    owner_id = vault_repo.get_owner(item_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Vault item not found")
    if owner_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to delete this vault item")

    vault_repo.delete(item_id)
    return {"message": "Vault item deleted successfully", "id": item_id}


# ==================== VERIFICATION PIPELINE ====================

@router.post("/{item_id}/verify")
def verify_vault_item(
    item_id: str,
    payload: VerifyVaultItemRequest,
    user_id: str = Depends(require_auth),
    vault_repo=Depends(get_vault_repo),
):
    """Evaluate submitted proof evidence and assign verification tier.
    
    Tiers assigned:
    - strong: official issuer credentials (Credly/accredited) or valid ZKP SNARK proof
    - mid: verified GitHub repo with commit authorship or active verified connected tool
    - weak: repository/live URL check or local Poseidon commitment
    - none: unverified / invalid / unsupported claims
    """
    item = vault_repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Vault item not found")
    if item.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to verify this vault item")

    stored_hash = item.get("poseidon_hash")
    result = VerificationService.evaluate(payload.proof_type, payload.evidence, stored_poseidon_hash=stored_hash)

    # Persist updated tier and verification metadata
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


# ==================== CONNECTED TOOLS & LIVING GRAPH ====================

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
    """Connect an external tool (GitHub, LeetCode, Credly) for Living Graph automation.
    
    SECURITY: No access tokens or private credentials stored.
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
    """Disconnect a connected tool."""
    owner_id = tool_repo.get_owner(tool_id)
    if not owner_id:
        raise HTTPException(status_code=404, detail="Connected tool not found")
    if owner_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to remove this connected tool")

    tool_repo.delete(tool_id)
    return {"message": "Tool disconnected successfully", "id": tool_id}


@router.post("/living-graph/sync")
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
