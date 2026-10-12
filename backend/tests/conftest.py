import os
import sys
from pathlib import Path

# Provide mock environment variables for test execution
os.environ.setdefault("SUPABASE_URL", "https://mock-test-project.supabase.co")
# A dummy JWT payload with role=service_role: header: {"alg":"HS256","typ":"JWT"} payload: {"role":"service_role"}
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.mock_signature")
os.environ.setdefault("FRONTEND_URL", "http://localhost:8080")

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT_DIR))

