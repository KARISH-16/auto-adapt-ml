import os
import shutil
import tempfile
from pathlib import Path

_TEST_ROOT = Path(tempfile.mkdtemp(prefix="auto-adapt-ml-tests-"))
os.environ["AUTO_ADAPT_STORAGE_DIR"] = str(_TEST_ROOT / "storage")
os.environ["AUTO_ADAPT_DATABASE_URL"] = f"sqlite:///{_TEST_ROOT / 'test.sqlite3'}"
os.environ["SESSION_SECRET"] = "test-secret-only-not-for-deployment"

import pytest
from fastapi.testclient import TestClient

from backend.app.db import Base, DATASET_ROOT, MODEL_ROOT, engine
from backend.app.main import app


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    shutil.rmtree(DATASET_ROOT, ignore_errors=True)
    shutil.rmtree(MODEL_ROOT, ignore_errors=True)
    DATASET_ROOT.mkdir(parents=True, exist_ok=True)
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
