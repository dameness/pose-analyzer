from pipeline.angle_calculator import calcular_angulo

# ---------------------------------------------------------------------------
# Índices dos keypoints MediaPipe relevantes para cada exercício
# Referência: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
# ---------------------------------------------------------------------------
NARIZ        = 0
OMBRO_ESQ    = 11
OMBRO_DIR    = 12
COTOVELO_ESQ = 13
COTOVELO_DIR = 14
PULSO_ESQ    = 15
QUADRIL_ESQ  = 23
QUADRIL_DIR  = 24
JOELHO_ESQ   = 25
JOELHO_DIR   = 26
TORNOZELO_ESQ = 27
TORNOZELO_DIR = 28
INDICE_PE_ESQ = 31
INDICE_PE_DIR = 32
PULSO_DIR     = 16

# ---------------------------------------------------------------------------
# Mapeamento lado → índices de keypoints
# ---------------------------------------------------------------------------

KEYPOINTS_POR_LADO = {
    "left": {
        "ombro": OMBRO_ESQ,
        "cotovelo": COTOVELO_ESQ,
        "pulso": PULSO_ESQ,
        "quadril": QUADRIL_ESQ,
        "joelho": JOELHO_ESQ,
        "tornozelo": TORNOZELO_ESQ,
        "indice_pe": INDICE_PE_ESQ,
    },
    "right": {
        "ombro": OMBRO_DIR,
        "cotovelo": COTOVELO_DIR,
        "pulso": PULSO_DIR,
        "quadril": QUADRIL_DIR,
        "joelho": JOELHO_DIR,
        "tornozelo": TORNOZELO_DIR,
        "indice_pe": INDICE_PE_DIR,
    },
}

# ---------------------------------------------------------------------------
# Limiares posturais — ajustar após validação com especialistas
# ---------------------------------------------------------------------------

# Squat
JOELHO_MINIMO_SQUAT    = 30    # ângulo mínimo aceitável no ponto mais baixo
JOELHO_MAXIMO_SQUAT    = 80   # ângulo máximo aceitável no ponto mais baixo
QUADRIL_MINIMO_SQUAT   = 45
TORNOZELO_MINIMO_SQUAT = 60    # dorsiflexão mínima no ponto mais baixo
TORNOZELO_MAXIMO_SQUAT = 90    # dorsiflexão máxima

# Push-up
COTOVELO_MINIMO_PUSHUP = 80
COTOVELO_MAXIMO_PUSHUP = 100
OMBRO_MINIMO_PUSHUP    = 30    # ângulo mínimo no ombro na descida
OMBRO_MAXIMO_PUSHUP    = 70    # ângulo máximo no ombro na descida
QUADRIL_MINIMO_PUSHUP  = 160   # quadril deve estar estendido (corpo reto)

# Sit-up
QUADRIL_MINIMO_SITUP   = 80
QUADRIL_MAXIMO_SITUP   = 110
COLUNA_MINIMO_SITUP    = 60    # curvatura mínima do tronco na subida
COLUNA_MAXIMO_SITUP    = 120   # curvatura máxima do tronco


# ---------------------------------------------------------------------------
# Utilitários
# ---------------------------------------------------------------------------

def _ponto_medio(p1: dict, p2: dict) -> dict:
    """Calcula o ponto médio entre dois keypoints (2D)."""
    return {
        "x": (p1["x"] + p2["x"]) / 2,
        "y": (p1["y"] + p2["y"]) / 2,
    }


# ---------------------------------------------------------------------------
# Funções de verificação por exercício
# ---------------------------------------------------------------------------

def verificar_squat(keypoints_por_frame: list[list[dict] | None], side: str = "left") -> dict:
    """
    Recebe a lista de keypoints de cada frame do vídeo.
    Retorna dict com ângulos por frame e resultado por articulação.
    Articulações analisadas: joelho, quadril, tornozelo.
    """
    kp = KEYPOINTS_POR_LADO[side]

    angulos_joelho    = []
    angulos_quadril   = []
    angulos_tornozelo = []

    for keypoints in keypoints_por_frame:
        if keypoints is None:
            continue

        angulo_joelho = calcular_angulo(
            keypoints[kp["quadril"]],
            keypoints[kp["joelho"]],
            keypoints[kp["tornozelo"]]
        )
        angulo_quadril = calcular_angulo(
            keypoints[kp["ombro"]],
            keypoints[kp["quadril"]],
            keypoints[kp["joelho"]]
        )
        angulo_tornozelo = calcular_angulo(
            keypoints[kp["joelho"]],
            keypoints[kp["tornozelo"]],
            keypoints[kp["indice_pe"]]
        )

        angulos_joelho.append(angulo_joelho)
        angulos_quadril.append(angulo_quadril)
        angulos_tornozelo.append(angulo_tornozelo)

    if not angulos_joelho:
        return _resultado_vazio()

    joelho_min    = min(angulos_joelho)
    quadril_min   = min(angulos_quadril)
    tornozelo_min = min(angulos_tornozelo)

    joelho_correto    = JOELHO_MINIMO_SQUAT <= joelho_min <= JOELHO_MAXIMO_SQUAT
    quadril_correto   = quadril_min >= QUADRIL_MINIMO_SQUAT
    tornozelo_correto = TORNOZELO_MINIMO_SQUAT <= tornozelo_min <= TORNOZELO_MAXIMO_SQUAT

    erros = []
    if not joelho_correto:
        if joelho_min > JOELHO_MAXIMO_SQUAT:
            erros.append("agachamento raso — joelho não atingiu a flexão necessária")
        else:
            erros.append("joelho com flexão excessiva")
    if not quadril_correto:
        erros.append("quadril não atingiu a posição correta")
    if not tornozelo_correto:
        if tornozelo_min < TORNOZELO_MINIMO_SQUAT:
            erros.append("dorsiflexão excessiva no tornozelo")
        else:
            erros.append("tornozelo com pouca mobilidade — dorsiflexão insuficiente")

    joint_results = {
        "knee":  "correct" if joelho_correto    else "incorrect",
        "hip":   "correct" if quadril_correto   else "incorrect",
        "ankle": "correct" if tornozelo_correto else "incorrect",
    }

    resultado_geral = "correct" if all(v == "correct" for v in joint_results.values()) else "incorrect"

    return {
        "result": resultado_geral,
        "joint_angles": {
            "knee":  angulos_joelho,
            "hip":   angulos_quadril,
            "ankle": angulos_tornozelo,
        },
        "joint_results": joint_results,
        "errors": erros,
    }


def verificar_pushup(keypoints_por_frame: list[list[dict] | None], side: str = "left") -> dict:
    """
    Verifica a execução de flexões (push-up).
    Articulações analisadas: cotovelo, ombro, quadril.
    """
    kp = KEYPOINTS_POR_LADO[side]

    angulos_cotovelo = []
    angulos_ombro    = []
    angulos_quadril  = []

    for keypoints in keypoints_por_frame:
        if keypoints is None:
            continue

        angulo_cotovelo = calcular_angulo(
            keypoints[kp["ombro"]],
            keypoints[kp["cotovelo"]],
            keypoints[kp["pulso"]]
        )
        angulo_ombro = calcular_angulo(
            keypoints[kp["cotovelo"]],
            keypoints[kp["ombro"]],
            keypoints[kp["quadril"]]
        )
        angulo_quadril = calcular_angulo(
            keypoints[kp["ombro"]],
            keypoints[kp["quadril"]],
            keypoints[kp["joelho"]]
        )

        angulos_cotovelo.append(angulo_cotovelo)
        angulos_ombro.append(angulo_ombro)
        angulos_quadril.append(angulo_quadril)

    if not angulos_cotovelo:
        return _resultado_vazio()

    cotovelo_min  = min(angulos_cotovelo)
    ombro_min     = min(angulos_ombro)
    quadril_medio = sum(angulos_quadril) / len(angulos_quadril)

    cotovelo_correto = COTOVELO_MINIMO_PUSHUP <= cotovelo_min <= COTOVELO_MAXIMO_PUSHUP
    ombro_correto    = OMBRO_MINIMO_PUSHUP <= ombro_min <= OMBRO_MAXIMO_PUSHUP
    quadril_correto  = quadril_medio >= QUADRIL_MINIMO_PUSHUP

    erros = []
    if not cotovelo_correto:
        erros.append("cotovelo não atingiu a flexão correta na descida")
    if not ombro_correto:
        if ombro_min < OMBRO_MINIMO_PUSHUP:
            erros.append("ombro com abertura insuficiente na descida")
        else:
            erros.append("ombro com abertura excessiva — braços muito afastados do corpo")
    if not quadril_correto:
        erros.append("quadril fora de alinhamento — corpo não está reto")

    joint_results = {
        "elbow":    "correct" if cotovelo_correto else "incorrect",
        "shoulder": "correct" if ombro_correto    else "incorrect",
        "hip":      "correct" if quadril_correto  else "incorrect",
    }

    resultado_geral = "correct" if all(v == "correct" for v in joint_results.values()) else "incorrect"

    return {
        "result": resultado_geral,
        "joint_angles": {
            "elbow":    angulos_cotovelo,
            "shoulder": angulos_ombro,
            "hip":      angulos_quadril,
        },
        "joint_results": joint_results,
        "errors": erros,
    }


def verificar_situp(keypoints_por_frame: list[list[dict] | None], side: str = "left") -> dict:
    """
    Verifica a execução de abdominais (sit-up).
    Articulações analisadas: quadril, coluna.
    A coluna é aproximada pelo ângulo nariz → centro_ombros → centro_quadris.
    """
    kp = KEYPOINTS_POR_LADO[side]

    angulos_quadril = []
    angulos_coluna  = []

    for keypoints in keypoints_por_frame:
        if keypoints is None:
            continue

        angulo_quadril = calcular_angulo(
            keypoints[kp["ombro"]],
            keypoints[kp["quadril"]],
            keypoints[kp["joelho"]]
        )

        centro_ombros  = _ponto_medio(keypoints[OMBRO_ESQ], keypoints[OMBRO_DIR])
        centro_quadris = _ponto_medio(keypoints[QUADRIL_ESQ], keypoints[QUADRIL_DIR])
        angulo_coluna = calcular_angulo(
            keypoints[NARIZ],
            centro_ombros,
            centro_quadris
        )

        angulos_quadril.append(angulo_quadril)
        angulos_coluna.append(angulo_coluna)

    if not angulos_quadril:
        return _resultado_vazio()

    quadril_min = min(angulos_quadril)
    coluna_min  = min(angulos_coluna)

    quadril_correto = QUADRIL_MINIMO_SITUP <= quadril_min <= QUADRIL_MAXIMO_SITUP
    coluna_correta  = COLUNA_MINIMO_SITUP <= coluna_min <= COLUNA_MAXIMO_SITUP

    erros = []
    if not quadril_correto:
        erros.append("amplitude do movimento insuficiente — não atingiu a posição correta")
    if not coluna_correta:
        if coluna_min < COLUNA_MINIMO_SITUP:
            erros.append("curvatura excessiva da coluna — risco de lesão")
        else:
            erros.append("coluna muito reta — flexão do tronco insuficiente")

    joint_results = {
        "hip":   "correct" if quadril_correto else "incorrect",
        "spine": "correct" if coluna_correta  else "incorrect",
    }

    resultado_geral = "correct" if all(v == "correct" for v in joint_results.values()) else "incorrect"

    return {
        "result": resultado_geral,
        "joint_angles": {
            "hip":   angulos_quadril,
            "spine": angulos_coluna,
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


def verificar_exercicio(exercise: str, keypoints_por_frame: list, side: str = "left") -> dict:
    """
    Ponto de entrada do postural_checker.
    Recebe o tipo de exercício e os keypoints de todos os frames.
    """
    verificador = VERIFICADORES.get(exercise)
    if verificador is None:
        raise ValueError(f"Exercício não suportado: {exercise}")
    return verificador(keypoints_por_frame, side)


def _resultado_vazio() -> dict:
    """Retornado quando nenhum keypoint foi detectado no vídeo."""
    return {
        "result": "incorrect",
        "joint_angles": {},
        "joint_results": {},
        "errors": ["nenhuma pose detectada no vídeo — verifique o enquadramento"],
    }
