import mediapipe as mp

mp_pose = mp.solutions.pose


def inicializar_pose(static_image_mode: bool = False) -> mp.solutions.pose.Pose:
    """
    Inicializa e retorna a instância do MediaPipe Pose.
    Usar static_image_mode=False para vídeos (mais eficiente em sequências de frames).
    Usar static_image_mode=True apenas para imagens isoladas.
    """
    return mp_pose.Pose(
        static_image_mode=static_image_mode,
        min_detection_confidence=0.5
    )


def extrair_keypoints(results) -> list[dict] | None:
    """
    Recebe o retorno do MediaPipe e extrai os 33 keypoints.
    Retorna None se nenhuma pose for detectada na imagem/frame.
    """
    if not results.pose_landmarks:
        return None

    pts = []
    for lm in results.pose_landmarks.landmark:
        pts.append({
            "x": lm.x,
            "y": lm.y,
            "z": lm.z,
            "visibility": lm.visibility
        })
    return pts
