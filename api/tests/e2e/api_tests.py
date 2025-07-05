import io

import gpxpy.gpx
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


@pytest.fixture(scope="module")
def sample_gpx_bytes():
    # Generate a simple GPX file in memory
    gpx = gpxpy.gpx.GPX()
    gpx_track = gpxpy.gpx.GPXTrack(name="Test Track")
    gpx.tracks.append(gpx_track)
    gpx_segment = gpxpy.gpx.GPXTrackSegment()
    gpx_track.segments.append(gpx_segment)
    gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(42.0, -1.0, elevation=100))
    gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(42.001, -1.001, elevation=120))
    gpx_segment.points.append(gpxpy.gpx.GPXTrackPoint(42.002, -1.002, elevation=110))
    gpx_bytes = gpx.to_xml().encode("utf-8")
    return gpx_bytes


def test_upload_gpx_and_search(sample_gpx_bytes):
    client = TestClient(app)
    response = client.post(
        "/api/upload_gpx",
        files={"file": ("test.gpx", sample_gpx_bytes, "application/gpx+xml")},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["status"] == "success"
    assert data["chunks_uploaded"] > 0

    # Check that the file appears in /api/files
    files_response = client.get("/api/files")
    assert files_response.status_code == 200
    files = files_response.json()["files"]
    assert "test.gpx" in files


def test_health_check():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "api" in data
    assert "vector_db" in data
    assert data["api"] == "ok"
    assert data["overall"] in ("ok", "degraded")
