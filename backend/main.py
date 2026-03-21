import os
import uuid
import threading
import tempfile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles

from models.schemas import JobQueued, JobStatusDone
from pipeline.video_processor import processar_video

app = FastAPI(title="Pose Analyzer API")

# Armazena o estado de cada job em memória
# { job_id: { "status": "queued"|"processing"|"done"|"error", "result": dict|str|None } }
jobs: dict[str, dict] = {}


@app.post("/analyze", response_model=JobQueued)
async def analyze(
    video: UploadFile = File(...),
    exercise: str = Form(...),
):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "result": None}

    conteudo = await video.read()
    content_type = video.content_type or ""
    sufixo = ".mp4" if "mp4" in content_type else ".webm"

    def executar() -> None:
        jobs[job_id]["status"] = "processing"
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=sufixo, delete=False) as tmp:
                tmp.write(conteudo)
                tmp_path = tmp.name

            resultado = processar_video(tmp_path, exercise)
            jobs[job_id]["status"] = "done"
            jobs[job_id]["result"] = resultado
        except Exception as exc:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["result"] = str(exc)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    threading.Thread(target=executar, daemon=True).start()
    return {"job_id": job_id, "status": "queued"}


@app.get("/status/{job_id}", response_model=None, responses={200: {"model": JobStatusDone}})
def status(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job não encontrado")

    if job["status"] == "done":
        return {"status": "done", "result": job["result"]}
    if job["status"] == "error":
        return {"status": "error", "result": job["result"]}
    return {"status": job["status"]}


# Serve o frontend buildado em produção (frontend/dist/)
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="static")
