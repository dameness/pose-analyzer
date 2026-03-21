from pydantic import BaseModel
from typing import Literal, Union


class AnalysisResult(BaseModel):
    exercise: Literal["squat", "situp", "pushup"]
    result: Literal["correct", "incorrect"]
    confidence: float
    frames_analyzed: int
    joint_angles: dict[str, list[float]]
    joint_results: dict[str, Literal["correct", "incorrect"]]
    errors: list[str]


class JobQueued(BaseModel):
    job_id: str
    status: Literal["queued"]


class JobStatusQueued(BaseModel):
    status: Literal["queued"]


class JobStatusProcessing(BaseModel):
    status: Literal["processing"]


class JobStatusDone(BaseModel):
    status: Literal["done"]
    result: AnalysisResult


class JobStatusError(BaseModel):
    status: Literal["error"]
    result: str


JobStatusResponse = Union[JobStatusQueued, JobStatusProcessing, JobStatusDone, JobStatusError]
