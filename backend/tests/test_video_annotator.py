"""Testes unitários para o módulo video_annotator."""

import os
import tempfile

import cv2
import numpy as np
import pytest

from pipeline.video_annotator import COR_CORRETO, COR_INCORRETO, COR_NEUTRO, _construir_mapa_cor, anotar_video


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _gerar_video_sintetico(num_frames: int, largura: int = 64, altura: int = 64, fps: float = 30.0) -> str:
    """Cria um vídeo mp4 sintético em arquivo temporário e retorna o caminho."""
    path = tempfile.mktemp(suffix=".mp4")
    writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (largura, altura))
    for _ in range(num_frames):
        frame = np.zeros((altura, largura, 3), dtype=np.uint8)
        writer.write(frame)
    writer.release()
    return path


def _kp(x: float = 0.5, y: float = 0.5) -> dict:
    return {"x": x, "y": y, "z": 0.0, "visibility": 1.0}


def _gerar_keypoints_frame() -> list[dict]:
    """Gera lista de 33 keypoints com posições distintas mas válidas."""
    kps = []
    for i in range(33):
        kps.append({"x": 0.1 + (i % 8) * 0.1, "y": 0.1 + (i // 8) * 0.2, "z": 0.0, "visibility": 1.0})
    return kps


# ---------------------------------------------------------------------------
# Testes de _construir_mapa_cor
# ---------------------------------------------------------------------------

class TestConstruirMapaCor:
    def test_joelho_incorreto_recebe_cor_incorreto_no_squat(self):
        joint_results = {"knee": "incorrect", "hip": "correct", "ankle": "correct"}
        mapa = _construir_mapa_cor("squat", joint_results)
        # índices 25 e 26 são joelho esquerdo e direito
        assert mapa[25] == COR_INCORRETO
        assert mapa[26] == COR_INCORRETO

    def test_quadril_correto_recebe_cor_correto_no_squat(self):
        joint_results = {"knee": "correct", "hip": "correct", "ankle": "correct"}
        mapa = _construir_mapa_cor("squat", joint_results)
        # índices 23 e 24 são quadril
        assert mapa[23] == COR_CORRETO
        assert mapa[24] == COR_CORRETO

    def test_landmarks_nao_mapeados_recebem_cor_neutro(self):
        joint_results = {"knee": "correct", "hip": "correct", "ankle": "correct"}
        mapa = _construir_mapa_cor("squat", joint_results)
        # índice 0 (nariz) não é analisado no squat
        assert mapa.get(0, COR_NEUTRO) == COR_NEUTRO

    def test_cotovelo_incorreto_recebe_cor_incorreto_no_pushup(self):
        joint_results = {"elbow": "incorrect", "shoulder": "correct", "hip": "correct"}
        mapa = _construir_mapa_cor("pushup", joint_results)
        assert mapa[13] == COR_INCORRETO
        assert mapa[14] == COR_INCORRETO

    def test_quadril_correto_recebe_cor_correto_no_situp(self):
        joint_results = {"hip": "correct", "spine": "incorrect"}
        mapa = _construir_mapa_cor("situp", joint_results)
        assert mapa[23] == COR_CORRETO
        assert mapa[24] == COR_CORRETO

    def test_spine_incorreto_inclui_nariz_no_situp(self):
        joint_results = {"hip": "correct", "spine": "incorrect"}
        mapa = _construir_mapa_cor("situp", joint_results)
        # índice 0 (nariz) faz parte da articulação spine no situp
        assert mapa[0] == COR_INCORRETO


# ---------------------------------------------------------------------------
# Testes de anotar_video
# ---------------------------------------------------------------------------

class TestAnotarVideo:
    def test_cria_arquivo_de_saida(self):
        video_path = _gerar_video_sintetico(num_frames=10)
        output_path = tempfile.mktemp(suffix="_ann.mp4")
        keypoints = [_gerar_keypoints_frame() for _ in range(10)]
        joint_results = {"knee": "correct", "hip": "correct", "ankle": "correct"}

        try:
            anotar_video(video_path, keypoints, joint_results, "squat", 30.0, 0, 10, output_path)
            assert os.path.exists(output_path)
        finally:
            os.unlink(video_path)
            if os.path.exists(output_path):
                os.unlink(output_path)

    def test_saida_tem_mesma_quantidade_de_frames(self):
        num_frames = 15
        video_path = _gerar_video_sintetico(num_frames=num_frames)
        output_path = tempfile.mktemp(suffix="_ann.mp4")
        keypoints = [_gerar_keypoints_frame() for _ in range(num_frames)]
        joint_results = {"knee": "correct", "hip": "correct", "ankle": "correct"}

        try:
            anotar_video(video_path, keypoints, joint_results, "squat", 30.0, 0, num_frames, output_path)
            cap = cv2.VideoCapture(output_path)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()
            assert frame_count == num_frames
        finally:
            os.unlink(video_path)
            if os.path.exists(output_path):
                os.unlink(output_path)

    def test_saida_tem_mesmas_dimensoes(self):
        largura, altura = 128, 96
        video_path = _gerar_video_sintetico(num_frames=5, largura=largura, altura=altura)
        output_path = tempfile.mktemp(suffix="_ann.mp4")
        keypoints = [_gerar_keypoints_frame() for _ in range(5)]
        joint_results = {"knee": "correct", "hip": "correct", "ankle": "correct"}

        try:
            anotar_video(video_path, keypoints, joint_results, "squat", 30.0, 0, 5, output_path)
            cap = cv2.VideoCapture(output_path)
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            cap.release()
            assert w == largura
            assert h == altura
        finally:
            os.unlink(video_path)
            if os.path.exists(output_path):
                os.unlink(output_path)

    def test_frames_com_keypoints_none_sao_escritos_sem_crash(self):
        """Frames sem pose detectada (keypoints=None) não devem causar erro."""
        video_path = _gerar_video_sintetico(num_frames=5)
        output_path = tempfile.mktemp(suffix="_ann.mp4")
        # metade dos frames sem keypoints
        keypoints = [None, _gerar_keypoints_frame(), None, _gerar_keypoints_frame(), None]
        joint_results = {"knee": "correct", "hip": "correct", "ankle": "correct"}

        try:
            anotar_video(video_path, keypoints, joint_results, "squat", 30.0, 0, 5, output_path)
            assert os.path.exists(output_path)
        finally:
            os.unlink(video_path)
            if os.path.exists(output_path):
                os.unlink(output_path)

    def test_frames_fora_do_intervalo_sao_incluidos_no_video(self):
        """Frames fora de [frame_inicio, frame_fim) ainda devem aparecer no vídeo anotado."""
        num_frames = 10
        video_path = _gerar_video_sintetico(num_frames=num_frames)
        output_path = tempfile.mktemp(suffix="_ann.mp4")
        keypoints = [_gerar_keypoints_frame() for _ in range(num_frames)]
        joint_results = {"knee": "correct", "hip": "correct", "ankle": "correct"}

        try:
            # apenas frames 3–7 são o intervalo de movimento
            anotar_video(video_path, keypoints, joint_results, "squat", 30.0, 3, 7, output_path)
            cap = cv2.VideoCapture(output_path)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()
            # vídeo completo, não trimado
            assert frame_count == num_frames
        finally:
            os.unlink(video_path)
            if os.path.exists(output_path):
                os.unlink(output_path)
