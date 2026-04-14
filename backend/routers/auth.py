from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
import httpx
from jose import jwt as jose_jwt, JWTError
from jose.utils import base64url_decode
import json

from database import get_db
from models import User
from auth import hash_password, verify_password, create_access_token, get_current_user
from config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if not body.email.lower().endswith("@superiorpaving.net"):
        raise HTTPException(status_code=400, detail="Only @superiorpaving.net emails are allowed to register.")

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role="hr_user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, full_name=user.full_name, role=user.role),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.put("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}


class UpdateProfileRequest(BaseModel):
    full_name: str


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.full_name = body.full_name
    await db.commit()
    await db.refresh(current_user)
    return current_user


# ── Microsoft SSO ─────────────────────────────────────────────────────────────

class MicrosoftLoginRequest(BaseModel):
    id_token: str


async def _get_microsoft_jwks(tenant_id: str) -> dict:
    """Fetch Microsoft's public JWKS for token validation."""
    url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


def _decode_microsoft_id_token(id_token: str, jwks: dict, client_id: str, tenant_id: str) -> dict:
    """Validate and decode a Microsoft ID token using python-jose."""
    # Build the list of keys
    from jose.backends import RSAKey
    from jose import jwk

    # Decode header to find the key id (kid)
    header = jose_jwt.get_unverified_header(id_token)
    kid = header.get("kid")

    # Find the matching key
    matching_key = None
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            matching_key = key_data
            break

    if not matching_key:
        raise HTTPException(status_code=401, detail="Microsoft token signing key not found")

    # Valid issuers for single-tenant and multi-tenant apps
    valid_issuers = [
        f"https://login.microsoftonline.com/{tenant_id}/v2.0",
        f"https://sts.windows.net/{tenant_id}/",
    ]

    try:
        payload = jose_jwt.decode(
            id_token,
            matching_key,
            algorithms=["RS256"],
            audience=client_id,
            options={"verify_iss": False},  # We check issuer manually below
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Microsoft token: {e}")

    # Manual issuer check (covers both v1 and v2 endpoints)
    iss = payload.get("iss", "")
    if not any(iss.startswith(vi.split("{")[0]) for vi in [
        "https://login.microsoftonline.com/",
        "https://sts.windows.net/",
    ]):
        raise HTTPException(status_code=401, detail="Invalid token issuer")

    return payload


@router.post("/microsoft", response_model=TokenResponse)
async def microsoft_login(body: MicrosoftLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Validate a Microsoft id_token (obtained via PKCE on the frontend),
    upsert the user, and return our own JWT.
    """
    if not settings.microsoft_client_id:
        raise HTTPException(status_code=503, detail="Microsoft SSO is not configured on this server")

    # 1. Fetch JWKS and validate the token
    try:
        jwks = await _get_microsoft_jwks(settings.microsoft_tenant_id)
    except Exception:
        raise HTTPException(status_code=503, detail="Could not reach Microsoft identity endpoint")

    claims = _decode_microsoft_id_token(
        body.id_token, jwks, settings.microsoft_client_id, settings.microsoft_tenant_id
    )

    # 2. Extract identity claims
    microsoft_oid = claims.get("oid") or claims.get("sub")
    email = (claims.get("preferred_username") or claims.get("email") or "").lower().strip()
    full_name = claims.get("name") or email.split("@")[0]

    if not email or not microsoft_oid:
        raise HTTPException(status_code=400, detail="Microsoft token missing required claims (email/oid)")

    # 3. Enforce domain restriction
    if not email.endswith("@superiorpaving.net"):
        raise HTTPException(
            status_code=403,
            detail="Only @superiorpaving.net Microsoft accounts are allowed to sign in.",
        )

    # 4. Upsert user — first try by microsoft_id, then by email
    result = await db.execute(select(User).where(User.microsoft_id == microsoft_oid))
    user = result.scalar_one_or_none()

    if not user:
        # Try to find an existing email+password account to link
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user:
        # Link / update
        user.microsoft_id = microsoft_oid
        if not user.full_name:
            user.full_name = full_name
    else:
        # Create new SSO-only account
        user = User(
            email=email,
            hashed_password=None,
            full_name=full_name,
            role="hr_user",
            microsoft_id=microsoft_oid,
        )
        db.add(user)

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    await db.commit()
    await db.refresh(user)

    # 5. Issue our own JWT
    token = create_access_token({"sub": user.id})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, full_name=user.full_name, role=user.role),
    )
