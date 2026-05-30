"""API integration tests for /normalize and /normalize/resolve endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestNormalizeEndpoint:
    def test_basic_normalization(self):
        resp = client.post("/normalize", json={
            "inputs": [
                {"name": "Hemoglobin A1c", "value": "6.2", "unit": "%"},
                {"name": "hba1c", "value": "5.4", "unit": "%"},
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["matched"] == 2
        assert data["unmatched"] == 0
        assert len(data["results"]) == 2
        assert data["results"][0]["canonical_name"] == "hba1c"

    def test_with_unknown(self):
        resp = client.post("/normalize", json={
            "inputs": [
                {"name": "totally unknown thing"},
                {"name": "hemoglobin", "value": "14.0", "unit": "g/dL"},
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["matched"] == 1
        assert data["unmatched"] == 1
        assert data["results"][0]["canonical_name"] is None
        assert data["results"][1]["canonical_name"] == "hemoglobin"

    def test_name_only_no_value(self):
        resp = client.post("/normalize", json={
            "inputs": [
                {"name": "HbA1c"},
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["matched"] == 1
        assert data["results"][0]["canonical_name"] == "hba1c"

    def test_empty_inputs(self):
        resp = client.post("/normalize", json={"inputs": []})
        assert resp.status_code == 200
        data = resp.json()
        assert data["matched"] == 0
        assert data["unmatched"] == 0

    def test_min_confidence_filter(self):
        resp = client.post("/normalize", json={
            "inputs": [{"name": "hba1c", "value": "5.4", "unit": "%"}],
            "min_confidence": 0.99,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["matched"] == 1  # exact match → confidence 1.0


class TestResolveEndpoint:
    def test_basic(self):
        resp = client.post("/normalize/resolve", json={
            "names": ["Hemoglobin A1c", "HbA1c", "A1C", "totally unknown"]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 4

        assert data["results"][0]["canonical_name"] == "hba1c"
        assert data["results"][1]["canonical_name"] == "hba1c"
        assert data["results"][2]["canonical_name"] == "hba1c"
        assert data["results"][3]["canonical_name"] is None

    def test_empty(self):
        resp = client.post("/normalize/resolve", json={"names": []})
        assert resp.status_code == 200
        assert len(resp.json()["results"]) == 0

    def test_duplicates(self):
        resp = client.post("/normalize/resolve", json={
            "names": ["hba1c", "hba1c", "hba1c"]
        })
        assert resp.status_code == 200
        assert len(resp.json()["results"]) == 3
        for r in resp.json()["results"]:
            assert r["canonical_name"] == "hba1c"
