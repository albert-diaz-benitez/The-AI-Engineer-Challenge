import io

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from api.app import app

load_dotenv()


@pytest.fixture(scope="module")
def sample_pdf_bytes():
    # Generate a simple PDF in memory
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    c.drawString(100, 750, "Hello world! This is a test PDF for E2E testing.")
    c.drawString(100, 730, "The quick brown fox jumps over the lazy dog.")
    c.save()
    buffer.seek(0)
    return buffer.read()


def test_upload_pdf_and_search(sample_pdf_bytes):
    # 1. Upload the PDF
    client = TestClient(app)
    response = client.post(
        "/api/upload_pdf",
        files={"file": ("test.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "success"
    assert data["chunks_uploaded"] > 0

    # 2. Search for a known word from the PDF
    search_response = client.post(
        "/api/search",
        json={"query": "quick brown fox", "k": 2},
    )
    assert search_response.status_code == 200, search_response.text
    results = search_response.json()["results"]
    assert any("quick brown fox" in r["text"] for r in results)
