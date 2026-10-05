from __future__ import annotations

from io import StringIO

import numpy as np
import pandas as pd


def make_csv(seed: int, shifted: bool = False) -> bytes:
    rng = np.random.default_rng(seed)
    rows = 80
    age = rng.normal(38 if not shifted else 58, 9, rows).clip(18, 80).round(1)
    spend = rng.normal(100 if not shifted else 175, 25, rows).clip(5, 300).round(2)
    segment = rng.choice(["basic", "plus", "premium"], rows)
    churn = ((age > 43).astype(int) + (spend < 75).astype(int) + (segment == "basic").astype(int) >= 2).astype(int)
    frame = pd.DataFrame({"age": age, "monthly_spend": spend, "segment": segment, "churn": churn})
    buffer = StringIO()
    frame.to_csv(buffer, index=False)
    return buffer.getvalue().encode("utf-8")


def signup(client, email: str = "karishma@example.com") -> None:
    response = client.post("/api/auth/signup", json={
        "full_name": "Karishma R",
        "email": email,
        "password": "SecurePassword123!",
    })
    assert response.status_code == 201, response.text


def upload(client, name: str, content: bytes) -> dict:
    response = client.post("/api/datasets/upload", files={"file": (name, content, "text/csv")})
    assert response.status_code == 201, response.text
    return response.json()


def test_real_workflow_signup_upload_train_deploy_predict_drift_retrain(client):
    signup(client)
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "karishma@example.com"

    reference = upload(client, "reference.csv", make_csv(1))
    incoming = upload(client, "incoming.csv", make_csv(2, shifted=True))
    assert reference["rowCount"] == 80
    assert reference["featureCount"] == 3

    preview = client.get(f"/api/datasets/{reference['id']}")
    assert preview.status_code == 200
    assert len(preview.json()["preview"]) == 10

    trained = client.post("/api/models/train", json={
        "dataset_id": reference["id"],
        "target_column": "churn",
        "task_type": "classification",
        "algorithm": "random_forest",
    })
    assert trained.status_code == 201, trained.text
    model = trained.json()
    assert model["metrics"]["test_rows"] > 0
    assert 0 <= model["accuracy"] <= 1
    assert model["status"] == "Evaluated"

    deployed = client.post(f"/api/models/{model['id']}/deploy")
    assert deployed.status_code == 200, deployed.text
    assert deployed.json()["status"] == "Deployed"

    prediction = client.post("/api/predictions", json={
        "model_id": model["id"],
        "features": {"age": 39, "monthly_spend": 115, "segment": "plus"},
    })
    assert prediction.status_code == 200, prediction.text
    assert "prediction" in prediction.json()

    # Match the frontend's no-body drift-check request; backend selects the
    # latest datasets and infers the trained target column when available.
    drift = client.post("/api/monitoring/check")
    assert drift.status_code == 200, drift.text
    assert drift.json()["features"]
    assert all(feature["name"] != "churn" for feature in drift.json()["features"])
    assert drift.json()["labelsAvailable"] is True
    assert drift.json()["severity"] in {"Healthy", "Watch", "Action needed"}

    retraining = client.post("/api/retraining")
    assert retraining.status_code == 201, retraining.text
    assert retraining.json()["status"] == "Completed"
    candidate_id = retraining.json()["candidateModelId"]
    assert candidate_id

    # If retraining did not auto-deploy the candidate, deploy it and then restore
    # the earlier version through the actual rollback endpoint.
    candidate = client.get("/api/models").json()
    candidate_record = next(item for item in candidate if item["id"] == candidate_id)
    if candidate_record["status"] != "Deployed":
        candidate_deploy = client.post(f"/api/models/{candidate_id}/deploy")
        assert candidate_deploy.status_code == 200, candidate_deploy.text
    restored = client.post(f"/api/models/{model['id']}/rollback")
    assert restored.status_code == 200, restored.text
    assert restored.json()["status"] == "Deployed"

    dashboard = client.get("/api/dashboard")
    assert dashboard.status_code == 200
    data = dashboard.json()
    assert data["datasetCount"] == 2
    assert data["modelCount"] >= 2
    assert data["driftEvents"] == 1
    assert data["retrainingJobs"] == 1
    assert data["deployedModel"] is not None

    activity = client.get("/api/activity")
    assert activity.status_code == 200
    assert {item["type"] for item in activity.json()} >= {"dataset", "train", "deploy", "prediction", "drift", "retrain"}

    # Logout removes the browser session; login restores it from persisted SQLite data.
    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/models").status_code == 401
    login = client.post("/api/auth/login", json={"email": "karishma@example.com", "password": "SecurePassword123!"})
    assert login.status_code == 200, login.text
    assert len(client.get("/api/models").json()) >= 2


def test_auth_validation_duplicate_email_and_owner_isolation(client):
    signup(client)
    duplicate = client.post("/api/auth/signup", json={
        "full_name": "Another Person",
        "email": "KARISHMA@example.com",
        "password": "SecurePassword123!",
    })
    assert duplicate.status_code == 409

    wrong_password = client.post("/api/auth/login", json={
        "email": "karishma@example.com",
        "password": "wrong-password",
    })
    assert wrong_password.status_code == 401

    dataset = upload(client, "private.csv", make_csv(3))
    client.post("/api/auth/logout")
    signup(client, "other@example.com")
    assert client.get(f"/api/datasets/{dataset['id']}").status_code == 404


def test_invalid_upload_and_training_inputs_are_rejected(client):
    signup(client)
    invalid_upload = client.post("/api/datasets/upload", files={"file": ("bad.txt", b"not csv", "text/plain")})
    assert invalid_upload.status_code == 400

    dataset = upload(client, "small.csv", make_csv(4))
    bad_target = client.post("/api/models/train", json={
        "dataset_id": dataset["id"],
        "target_column": "missing_target",
        "task_type": "classification",
        "algorithm": "random_forest",
    })
    assert bad_target.status_code == 400


def test_regression_training_persists_r2_and_error_metrics(client):
    signup(client)
    rng = np.random.default_rng(22)
    x1 = rng.normal(10, 3, 70)
    x2 = rng.normal(4, 1, 70)
    target = 2.5 * x1 - 1.2 * x2 + rng.normal(0, 0.5, 70)
    frame = pd.DataFrame({"x1": x1, "x2": x2, "target": target})
    buffer = StringIO()
    frame.to_csv(buffer, index=False)
    dataset = upload(client, "regression.csv", buffer.getvalue().encode())
    response = client.post("/api/models/train", json={
        "dataset_id": dataset["id"],
        "target_column": "target",
        "task_type": "regression",
        "algorithm": "linear_regression",
    })
    assert response.status_code == 201, response.text
    metrics = response.json()["metrics"]
    assert "r2" in metrics and "rmse" in metrics and "mae" in metrics
    assert metrics["rmse"] >= 0


def test_dataset_deletion_cleans_dependent_records(client):
    signup(client)
    dataset = upload(client, "to-delete.csv", make_csv(11))
    trained = client.post("/api/models/train", json={
        "dataset_id": dataset["id"],
        "target_column": "churn",
        "task_type": "classification",
        "algorithm": "decision_tree",
    })
    assert trained.status_code == 201, trained.text
    deleted = client.delete(f"/api/datasets/{dataset['id']}")
    assert deleted.status_code == 204, deleted.text
    assert client.get("/api/datasets").json() == []
    assert client.get("/api/models").json() == []
    assert client.get("/api/dashboard").json()["datasetCount"] == 0
