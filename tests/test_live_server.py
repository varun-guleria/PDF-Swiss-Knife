"""
test_live_server.py — End-to-end test against the live running server on localhost:5000.
"""

import io
import time
import json
import urllib.request
from pypdf import PdfWriter, PdfReader


def make_pdf(page_count: int) -> bytes:
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def run_live_merge_test():
    base_url = "http://127.0.0.1:5000"

    # 1. Health check
    res = urllib.request.urlopen(f"{base_url}/api/health")
    assert res.status == 200
    print("Health check OK:", json.loads(res.read().decode()))

    # 2. Build multipart body
    boundary = "----WebKitFormBoundaryLiveTest123"
    body = io.BytesIO()

    for idx, pages in enumerate([2, 4]):
        body.write(f"--{boundary}\r\n".encode())
        body.write(
            f'Content-Disposition: form-data; name="files"; filename="doc_{idx+1}.pdf"\r\n'.encode()
        )
        body.write(b"Content-Type: application/pdf\r\n\r\n")
        body.write(make_pdf(pages))
        body.write(b"\r\n")

    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="output_name"\r\n\r\n')
    body.write(b"live_merged_result.pdf\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{base_url}/api/merge/run",
        data=body.getvalue(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )

    res = urllib.request.urlopen(req)
    assert res.status == 202
    data = json.loads(res.read().decode())
    job_id = data["job_id"]
    print("Merge job accepted, ID:", job_id)

    # 3. Poll status
    deadline = time.time() + 5.0
    final_status = None
    while time.time() < deadline:
        time.sleep(0.1)
        st_res = urllib.request.urlopen(f"{base_url}/api/jobs/{job_id}/status")
        status_info = json.loads(st_res.read().decode())
        if status_info["status"] in ("done", "error"):
            final_status = status_info
            break

    assert final_status is not None
    assert final_status["status"] == "done", f"Job failed: {final_status}"
    print("Merge job completed:", final_status["message"])

    # 4. Download output
    dl_res = urllib.request.urlopen(
        f"{base_url}/api/output/{job_id}/download/live_merged_result.pdf"
    )
    assert dl_res.status == 200
    pdf_bytes = dl_res.read()
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 6
    print(f"SUCCESS: Downloaded merged PDF with {len(reader.pages)} pages ({len(pdf_bytes)} bytes)!")


def run_live_pages_test():
    base_url = "http://127.0.0.1:5000"
    print("\nStarting live Page Organization test...")

    # 1. Inspect
    boundary = "----WebKitFormBoundaryPagesTest123"
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="file"; filename="source_doc.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(make_pdf(3))
    body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{base_url}/api/pages/inspect",
        data=body.getvalue(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    inspect_res = urllib.request.urlopen(req)
    assert inspect_res.status == 200
    info = json.loads(inspect_res.read().decode())
    doc_id = info["doc_id"]
    print(f"Page inspection OK: {info['page_count']} pages, doc_id={doc_id}")

    # 2. Thumbnail
    thumb_res = urllib.request.urlopen(f"{base_url}/api/pages/{doc_id}/thumbnail/0")
    assert thumb_res.status == 200
    thumb_bytes = thumb_res.read()
    assert thumb_bytes[:2] == b"\xff\xd8"
    print(f"Thumbnail rendered OK: {len(thumb_bytes)} bytes JPEG")

    # 3. Reorganize
    payload = json.dumps({
        "doc_id": doc_id,
        "output_name": "live_organized.pdf",
        "page_specs": [
            {"index": 2, "rotation": 90},
            {"index": 0, "rotation": 180},
        ],
    }).encode("utf-8")

    req2 = urllib.request.Request(
        f"{base_url}/api/pages/reorganize",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    reorg_res = urllib.request.urlopen(req2)
    assert reorg_res.status == 202
    job_id = json.loads(reorg_res.read().decode())["job_id"]

    # Poll status
    deadline = time.time() + 5.0
    final_status = None
    while time.time() < deadline:
        time.sleep(0.1)
        st_res = urllib.request.urlopen(f"{base_url}/api/jobs/{job_id}/status")
        status_info = json.loads(st_res.read().decode())
        if status_info["status"] in ("done", "error"):
            final_status = status_info
            break

    assert final_status is not None
    assert final_status["status"] == "done"
    print("Reorganize job completed:", final_status["message"])

    # Download output
    dl_res = urllib.request.urlopen(f"{base_url}/api/output/{job_id}/download/live_organized.pdf")
    assert dl_res.status == 200
    pdf_bytes = dl_res.read()
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 2
    assert reader.pages[0].rotation == 90
    assert reader.pages[1].rotation == 180
    print(f"SUCCESS: Downloaded reorganized PDF with {len(reader.pages)} pages ({len(pdf_bytes)} bytes)!\n")


def run_live_m6_test():
    base_url = "http://127.0.0.1:5000"
    print("Starting live M6 Utilities test...")

    # 1. Info endpoint
    boundary = "----LiveM6InfoBoundary"
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="file"; filename="test_info.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(make_pdf(4))
    body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{base_url}/api/optimize/info",
        data=body.getvalue(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    res = urllib.request.urlopen(req)
    assert res.status == 200
    info_data = json.loads(res.read().decode())
    assert info_data["page_count"] == 4
    print(f"PDF Info OK: {info_data['page_count']} pages, {info_data['pages'][0]['width_pt']}x{info_data['pages'][0]['height_pt']} pt")

    # 2. Split endpoint
    boundary = "----LiveM6SplitBoundary"
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="file"; filename="test_split.pdf"\r\n')
    body.write(b"Content-Type: application/pdf\r\n\r\n")
    body.write(make_pdf(3))
    body.write(b"\r\n")
    body.write(f"--{boundary}\r\n".encode())
    body.write(b'Content-Disposition: form-data; name="mode"\r\n\r\n')
    body.write(b"singles\r\n")
    body.write(f"--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        f"{base_url}/api/split/run",
        data=body.getvalue(),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    res = urllib.request.urlopen(req)
    assert res.status == 202
    job_id = json.loads(res.read().decode())["job_id"]

    # Poll status
    deadline = time.time() + 5.0
    final_status = None
    while time.time() < deadline:
        time.sleep(0.1)
        st_res = urllib.request.urlopen(f"{base_url}/api/jobs/{job_id}/status")
        status_info = json.loads(st_res.read().decode())
        if status_info["status"] in ("done", "error"):
            final_status = status_info
            break

    assert final_status is not None
    assert final_status["status"] == "done"
    print("Split job completed:", final_status["message"])

    # Download ZIP
    zip_res = urllib.request.urlopen(f"{base_url}/api/output/{job_id}/zip")
    assert zip_res.status == 200
    zip_bytes = zip_res.read()
    assert len(zip_bytes) > 0
    print(f"SUCCESS: Downloaded split ZIP ({len(zip_bytes)} bytes)!\n")


if __name__ == "__main__":
    run_live_merge_test()
    run_live_pages_test()
    run_live_m6_test()
