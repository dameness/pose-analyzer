import os
import uuid
import threading
import tempfile

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from models.schemas import JobQueued, JobStatusDone
from pipeline.video_processor import processar_video

load_dotenv()

_origins_raw = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()] or ["http://localhost:5173"]

app = FastAPI(title="Pose Analyzer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Armazena o estado de cada job em memória
# { job_id: { "status": "queued"|"processing"|"done"|"error", "result": dict|None, "message": str|None, "error_type": str|None } }
jobs: dict[str, dict] = {}

_EXERCICIOS_VALIDOS = {"squat", "situp", "pushup"}
# Manter sincronizado com VERIFICADORES em pipeline/postural_checker.py

_CONTENT_TYPES_VALIDOS = {"video/mp4", "video/webm", "video/quicktime"}
_EXTENSOES_VALIDAS = {".mp4", ".webm", ".mov"}


@app.post("/analyze", response_model=JobQueued, status_code=202)
async def analyze(
    video: UploadFile = File(...),
    exercise: str = Form(...),
):
    if exercise not in _EXERCICIOS_VALIDOS:
        raise HTTPException(
            status_code=422,
            detail=f"Exercício não suportado: '{exercise}'. Valores aceitos: {sorted(_EXERCICIOS_VALIDOS)}",
        )

    content_type = (video.content_type or "").lower()
    extensao = os.path.splitext(video.filename or "")[1].lower()
    if content_type not in _CONTENT_TYPES_VALIDOS and extensao not in _EXTENSOES_VALIDAS:
        raise HTTPException(
            status_code=415,
            detail="Formato de vídeo não suportado. Envie um arquivo mp4, webm ou mov.",
        )

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "queued", "result": None}

    conteudo = await video.read()
    if "mp4" in content_type:
        sufixo = ".mp4"
    elif "quicktime" in content_type or extensao == ".mov":
        sufixo = ".mov"
    else:
        sufixo = ".webm"

    def executar() -> None:
        jobs[job_id]["status"] = "processing"
        tmp_path = None
        fd, video_anotado_path = tempfile.mkstemp(suffix="_annotated.mp4")
        os.close(fd)
        try:
            with tempfile.NamedTemporaryFile(suffix=sufixo, delete=False) as tmp:
                tmp.write(conteudo)
                tmp_path = tmp.name

            resultado = processar_video(tmp_path, exercise, annotated_output_path=video_anotado_path)
            resultado["video_url"] = f"/video/{job_id}"
            jobs[job_id]["status"] = "done"
            jobs[job_id]["result"] = resultado
            jobs[job_id]["video_path"] = video_anotado_path
        except ValueError as exc:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error_type"] = "validation_error"
            jobs[job_id]["message"] = str(exc)
        except RuntimeError as exc:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error_type"] = "invalid_file"
            jobs[job_id]["message"] = str(exc)
        except Exception as exc:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error_type"] = "processing_error"
            jobs[job_id]["message"] = str(exc)
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
        return {
            "status": "error",
            "error_type": job.get("error_type", "processing_error"),
            "message": job.get("message", "Erro desconhecido"),
        }
    return {"status": job["status"]}


@app.get("/video/{job_id}")
def get_video(job_id: str):
    job = jobs.get(job_id)
    if job is None or job["status"] != "done":
        raise HTTPException(status_code=404, detail="Vídeo não disponível")
    video_path = job.get("video_path")
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Arquivo de vídeo não encontrado")
    return FileResponse(video_path, media_type="video/mp4")


# Serve o frontend buildado em produção (frontend/dist/)
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="static")
