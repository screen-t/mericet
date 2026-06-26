"""Central dependency injection wiring.

All repository and service factory functions live here. Routes inject
dependencies via FastAPI's Depends() system. To swap providers (e.g.,
Supabase → SQLAlchemy), change only the imports and return types below.
"""

from functools import lru_cache
from app.lib.supabase import supabase

# --- Auth & Storage services ---

from app.services.supabase.auth_service import SupabaseAuthService
from app.services.supabase.storage_service import SupabaseStorageService


@lru_cache(maxsize=1)
def get_auth_service():
    return SupabaseAuthService(supabase)


@lru_cache(maxsize=1)
def get_storage_service():
    return SupabaseStorageService(supabase)


# --- Repositories ---
# Uncomment each as its Supabase implementation is created (Phases 2-7).

# from app.repositories.supabase.user_repo import (
#     SupabaseUserRepository,
#     SupabaseWorkExperienceRepository,
#     SupabaseEducationRepository,
#     SupabaseSkillRepository,
#     SupabaseLoginActivityRepository,
# )
# from app.repositories.supabase.follow_repo import SupabaseFollowRepository
# from app.repositories.supabase.notification_repo import SupabaseNotificationRepository
# from app.repositories.supabase.report_repo import SupabaseReportRepository
# from app.repositories.supabase.connection_repo import SupabaseConnectionRepository
# from app.repositories.supabase.save_repo import SupabaseSaveRepository
# from app.repositories.supabase.post_repo import SupabasePostRepository
# from app.repositories.supabase.message_repo import SupabaseMessageRepository


# @lru_cache(maxsize=1)
# def get_user_repo():
#     return SupabaseUserRepository(supabase)

# @lru_cache(maxsize=1)
# def get_work_experience_repo():
#     return SupabaseWorkExperienceRepository(supabase)

# @lru_cache(maxsize=1)
# def get_education_repo():
#     return SupabaseEducationRepository(supabase)

# @lru_cache(maxsize=1)
# def get_skill_repo():
#     return SupabaseSkillRepository(supabase)

# @lru_cache(maxsize=1)
# def get_login_activity_repo():
#     return SupabaseLoginActivityRepository(supabase)

# @lru_cache(maxsize=1)
# def get_follow_repo():
#     return SupabaseFollowRepository(supabase)

# @lru_cache(maxsize=1)
# def get_notification_repo():
#     return SupabaseNotificationRepository(supabase)

# @lru_cache(maxsize=1)
# def get_report_repo():
#     return SupabaseReportRepository(supabase)

# @lru_cache(maxsize=1)
# def get_connection_repo():
#     return SupabaseConnectionRepository(supabase)

# @lru_cache(maxsize=1)
# def get_save_repo():
#     return SupabaseSaveRepository(supabase)

# @lru_cache(maxsize=1)
# def get_post_repo():
#     return SupabasePostRepository(supabase)

# @lru_cache(maxsize=1)
# def get_message_repo():
#     return SupabaseMessageRepository(supabase)
