import os

import cv2
from pipeline.mediapipe_runner import inicializar_pose, extrair_keypoints
from pipeline.postural_checker import verificar_exercicio

_MAX_DURACAO = int(os.getenv("MAX_VIDEO_DURATION_SECONDS", "30"))


def processar_video(video_path: str, exercise: str) -> dict:
    """
    Ponto de entrada do pipeline completo.
    Recebe o caminho do vídeo e o tipo de exercício.
    Retorna o dict de resultado conforme o contrato da API.
    """
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise RuntimeError(f"Não foi possível abrir o vídeo: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    duracao = total_frames / fps if fps > 0 else 0

    if duracao > _MAX_DURACAO:
        cap.release()
        raise ValueError(
            f"Vídeo muito longo: {duracao:.1f}s (máximo permitido: {_MAX_DURACAO}s)"
        )

    # static_image_mode=False é mais eficiente para sequências de frames
    pose = inicializar_pose(static_image_mode=False)

    keypoints_por_frame = []

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(frame_rgb)
            keypoints = extrair_keypoints(results)
            keypoints_por_frame.append(keypoints)

    finally:
        cap.release()
        pose.close()

    frames_analisados = len([k for k in keypoints_por_frame if k is not None])

    # Confiança média da detecção — média de visibility de todos os keypoints detectados
    visibilidades = [
        lm["visibility"]
        for kps in keypoints_por_frame if kps is not None
        for lm in kps
    ]
    confidence = sum(visibilidades) / len(visibilidades) if visibilidades else 0.0

    resultado = verificar_exercicio(exercise, keypoints_por_frame)

    return {
        "exercise": exercise,
        "confidence": round(confidence, 4),
        "frames_analyzed": frames_analisados,
        **resultado,  # result, joint_angles, joint_results, errors
    }
