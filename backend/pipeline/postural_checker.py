from pipeline.angle_calculator import calcular_angulo

# ---------------------------------------------------------------------------
# Índices dos keypoints MediaPipe relevantes para cada exercício
# Referência: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
# ---------------------------------------------------------------------------
OMBRO_ESQ   = 11
OMBRO_DIR   = 12
COTOVELO_ESQ = 13
COTOVELO_DIR = 14
QUADRIL_ESQ = 23
QUADRIL_DIR = 24
JOELHO_ESQ  = 25
JOELHO_DIR  = 26
TORNOZELO_ESQ = 27
TORNOZELO_DIR = 28

# ---------------------------------------------------------------------------
# Limiares posturais — ajustar após validação com especialistas
# ---------------------------------------------------------------------------

# Squat
JOELHO_MINIMO_SQUAT   = 70    # ângulo mínimo aceitável no ponto mais baixo
JOELHO_MAXIMO_SQUAT   = 100   # ângulo máximo aceitável no ponto mais baixo
QUADRIL_MINIMO_SQUAT  = 80

# Push-up
COTOVELO_MINIMO_PUSHUP = 80
COTOVELO_MAXIMO_PUSHUP = 100
QUADRIL_MINIMO_PUSHUP  = 160  # quadril deve estar estendido (corpo reto)

# Sit-up
QUADRIL_MINIMO_SITUP  = 80
QUADRIL_MAXIMO_SITUP  = 110


# ---------------------------------------------------------------------------
# Funções de verificação por exercício
# ---------------------------------------------------------------------------

def verificar_squat(keypoints_por_frame: list[list[dict] | None]) -> dict:
    """
    Recebe a lista de keypoints de cada frame do vídeo.
    Retorna dict com ângulos por frame e resultado por articulação.
    """
    angulos_joelho  = []
    angulos_quadril = []
    angulos_tornozelo = []

    for keypoints in keypoints_por_frame:
        if keypoints is None:
            continue

        angulo_joelho = calcular_angulo(
            keypoints[QUADRIL_ESQ],
            keypoints[JOELHO_ESQ],
            keypoints[TORNOZELO_ESQ]
        )
        angulo_quadril = calcular_angulo(
            keypoints[OMBRO_ESQ],
            keypoints[QUADRIL_ESQ],
            keypoints[JOELHO_ESQ]
        )

        angulos_joelho.append(angulo_joelho)
        angulos_quadril.append(angulo_quadril)

    if not angulos_joelho:
        return _resultado_vazio()

    joelho_min  = min(angulos_joelho)
    quadril_min = min(angulos_quadril)

    joelho_correto  = JOELHO_MINIMO_SQUAT <= joelho_min <= JOELHO_MAXIMO_SQUAT
    quadril_correto = quadril_min >= QUADRIL_MINIMO_SQUAT

    erros = []
    if not joelho_correto:
        if joelho_min > JOELHO_MAXIMO_SQUAT:
            erros.append("agachamento raso — joelho não atingiu a flexão necessária")
        else:
            erros.append("joelho com flexão excessiva")
    if not quadril_correto:
        erros.append("quadril não atingiu a posição correta")

    joint_results = {
        "knee": "correct" if joelho_correto else "incorrect",
        "hip":  "correct" if quadril_correto else "incorrect",
    }

    resultado_geral = "correct" if all(v == "correct" for v in joint_results.values()) else "incorrect"

    return {
        "result": resultado_geral,
        "joint_angles": {
            "knee": angulos_joelho,
            "hip":  angulos_quadril,
        },
        "joint_results": joint_results,
        "errors": erros,
    }


def verificar_pushup(keypoints_por_frame: list[list[dict] | None]) -> dict:
    """
    Verifica a execução de flexões (push-up).
    """
    angulos_cotovelo = []
    angulos_quadril  = []

    for keypoints in keypoints_por_frame:
        if keypoints is None:
            continue

        angulo_cotovelo = calcular_angulo(
            keypoints[OMBRO_ESQ],
            keypoints[COTOVELO_ESQ],
            keypoints[14]  # pulso esquerdo = índice 15, mas vértice é cotovelo
        )
        angulo_quadril = calcular_angulo(
            keypoints[OMBRO_ESQ],
            keypoints[QUADRIL_ESQ],
            keypoints[JOELHO_ESQ]
        )

        angulos_cotovelo.append(angulo_cotovelo)
        angulos_quadril.append(angulo_quadril)

    if not angulos_cotovelo:
        return _resultado_vazio()

    cotovelo_min  = min(angulos_cotovelo)
    quadril_medio = sum(angulos_quadril) / len(angulos_quadril)

    cotovelo_correto = COTOVELO_MINIMO_PUSHUP <= cotovelo_min <= COTOVELO_MAXIMO_PUSHUP
    quadril_correto  = quadril_medio >= QUADRIL_MINIMO_PUSHUP

    erros = []
    if not cotovelo_correto:
        erros.append("cotovelo não atingiu a flexão correta na descida")
    if not quadril_correto:
        erros.append("quadril fora de alinhamento — corpo não está reto")

    joint_results = {
        "elbow": "correct" if cotovelo_correto else "incorrect",
        "hip":   "correct" if quadril_correto  else "incorrect",
    }

    resultado_geral = "correct" if all(v == "correct" for v in joint_results.values()) else "incorrect"

    return {
        "result": resultado_geral,
        "joint_angles": {
            "elbow": angulos_cotovelo,
            "hip":   angulos_quadril,
        },
        "joint_results": joint_results,
        "errors": erros,
    }


def verificar_situp(keypoints_por_frame: list[list[dict] | None]) -> dict:
    """
    Verifica a execução de abdominais (sit-up).
    """
    angulos_quadril = []

    for keypoints in keypoints_por_frame:
        if keypoints is None:
            continue

        angulo_quadril = calcular_angulo(
            keypoints[OMBRO_ESQ],
            keypoints[QUADRIL_ESQ],
            keypoints[JOELHO_ESQ]
        )
        angulos_quadril.append(angulo_quadril)

    if not angulos_quadril:
        return _resultado_vazio()

    quadril_min = min(angulos_quadril)
    quadril_correto = QUADRIL_MINIMO_SITUP <= quadril_min <= QUADRIL_MAXIMO_SITUP

    erros = []
    if not quadril_correto:
        erros.append("amplitude do movimento insuficiente — não atingiu a posição correta")

    joint_results = {
        "hip": "correct" if quadril_correto else "incorrect",
    }

    resultado_geral = "correct" if all(v == "correct" for v in joint_results.values()) else "incorrect"

    return {
        "result": resultado_geral,
        "joint_angles": {
            "hip": angulos_quadril,
        },
        "joint_results": joint_results,
        "errors": erros,
    }


# ---------------------------------------------------------------------------
# Dispatcher — escolhe a função de verificação pelo tipo de exercício
# ---------------------------------------------------------------------------

VERIFICADORES = {
    "squat":  verificar_squat,
    "pushup": verificar_pushup,
    "situp":  verificar_situp,
}


def verificar_exercicio(exercise: str, keypoints_por_frame: list) -> dict:
    """
    Ponto de entrada do postural_checker.
    Recebe o tipo de exercício e os keypoints de todos os frames.
    """
    verificador = VERIFICADORES.get(exercise)
    if verificador is None:
        raise ValueError(f"Exercício não suportado: {exercise}")
    return verificador(keypoints_por_frame)


def _resultado_vazio() -> dict:
    """Retornado quando nenhum keypoint foi detectado no vídeo."""
    return {
        "result": "incorrect",
        "joint_angles": {},
        "joint_results": {},
        "errors": ["nenhuma pose detectada no vídeo — verifique o enquadramento"],
    }
