"""
Analizador de compás (time signature) usando librosa
"""
import librosa
import numpy as np

def analyze_time_signature(audio_path):
    """
    Analiza el compás de un archivo de audio
    
    Args:
        audio_path: Ruta al archivo de audio
        
    Returns:
        dict con información del compás
    """
    try:
        print(f"[TIME SIG] Analizando compás: {audio_path}")
        
        # Cargar audio (solo primeros 60 segundos para análisis rápido)
        y, sr = librosa.load(audio_path, duration=60)
        print(f"[TIME SIG] Audio cargado: {len(y)/sr:.1f}s, SR: {sr}")
        
        # Detectar tempo y beats
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        print(f"[TIME SIG] Tempo detectado: {tempo:.1f} BPM")
        print(f"[TIME SIG] Beats detectados: {len(beats)}")
        
        # Calcular intervalos entre beats
        beat_times = librosa.frames_to_time(beats, sr=sr)
        if len(beat_times) < 4:
            print("[TIME SIG] No hay suficientes beats para análisis")
            return {
                "time_signature": "4/4",
                "confidence": 0.5,
                "detected_pattern": "default"
            }
        
        beat_intervals = np.diff(beat_times)
        
        # Detectar downbeats (beats fuertes) usando análisis de energía
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        
        # Analizar la energía en los beats
        beat_strengths = []
        for beat_frame in beats:
            if beat_frame < len(onset_env):
                beat_strengths.append(onset_env[beat_frame])
        
        beat_strengths = np.array(beat_strengths)
        
        # Normalizar
        if len(beat_strengths) > 0 and beat_strengths.max() > 0:
            beat_strengths = beat_strengths / beat_strengths.max()
        
        # Buscar patrones de acentuación
        # Para 4/4: patrón fuerte-débil-medio-débil
        # Para 3/4: patrón fuerte-débil-débil
        # Para 6/8: patrón fuerte-débil-débil-medio-débil-débil
        
        time_sig, confidence, pattern = detect_meter_pattern(beat_strengths, beat_intervals)
        
        print(f"[TIME SIG] Resultado: {time_sig}, Patrón: {pattern}, Confianza: {confidence*100:.1f}%")
        
        return {
            "time_signature": time_sig,
            "confidence": float(confidence),
            "detected_pattern": pattern,
            "tempo": float(tempo),
            "beats_analyzed": len(beats)
        }
        
    except Exception as e:
        print(f"[TIME SIG] Error: {e}")
        import traceback
        traceback.print_exc()
        # Retornar 4/4 por defecto en caso de error
        return {
            "time_signature": "4/4",
            "confidence": 0.5,
            "detected_pattern": "default_error"
        }


def detect_meter_pattern(beat_strengths, beat_intervals):
    """
    Detecta el patrón métrico basándose en las fuerzas de los beats
    """
    if len(beat_strengths) < 8:
        return "4/4", 0.6, "insufficient_data"
    
    # Probar diferentes patrones
    patterns = {
        "4/4": 4,
        "3/4": 3,
        "6/8": 6,
        "5/4": 5,
        "7/8": 7
    }
    
    scores = {}
    
    for time_sig, beats_per_bar in patterns.items():
        score = calculate_pattern_score(beat_strengths, beats_per_bar)
        scores[time_sig] = score
    
    # Encontrar el mejor match
    best_time_sig = max(scores, key=scores.get)
    best_score = scores[best_time_sig]
    
    # Si el score es muy bajo, asumir 4/4
    if best_score < 0.3:
        return "4/4", 0.6, "default_low_confidence"
    
    # Normalizar confianza
    confidence = min(best_score, 1.0)
    
    # Si es muy cercano a 4/4 y el score de 4/4 es razonable, preferir 4/4
    # (ya que es el más común)
    if best_time_sig != "4/4" and scores["4/4"] > best_score * 0.85:
        return "4/4", scores["4/4"], "4/4_preference"
    
    return best_time_sig, confidence, f"detected_{beats_per_bar}_pattern"


def calculate_pattern_score(beat_strengths, beats_per_bar):
    """
    Calcula qué tan bien encaja un patrón métrico con las fuerzas de beats
    """
    if len(beat_strengths) < beats_per_bar * 2:
        return 0.0
    
    # Agrupar beats según el patrón
    num_bars = len(beat_strengths) // beats_per_bar
    if num_bars < 2:
        return 0.0
    
    # Remodelar en barras
    truncated_length = num_bars * beats_per_bar
    bars = beat_strengths[:truncated_length].reshape(num_bars, beats_per_bar)
    
    # Promediar las fuerzas de cada posición en la barra
    avg_pattern = np.mean(bars, axis=0)
    
    # El primer beat debe ser el más fuerte
    if avg_pattern[0] < np.mean(avg_pattern[1:]):
        return 0.0
    
    # Calcular score basado en:
    # 1. Qué tan fuerte es el primer beat comparado con los demás
    first_beat_strength = avg_pattern[0]
    other_beats_avg = np.mean(avg_pattern[1:])
    
    if other_beats_avg == 0:
        contrast_score = 0.5
    else:
        contrast_score = min((first_beat_strength - other_beats_avg) / first_beat_strength, 1.0)
    
    # 2. Consistencia del patrón a través de las barras
    pattern_consistency = 0.0
    for i in range(beats_per_bar):
        column = bars[:, i]
        if len(column) > 1:
            # Usar coeficiente de variación inverso como medida de consistencia
            std = np.std(column)
            mean = np.mean(column)
            if mean > 0:
                cv = std / mean
                pattern_consistency += (1.0 / (1.0 + cv))
    
    pattern_consistency /= beats_per_bar
    
    # Score final es una combinación de contraste y consistencia
    final_score = (contrast_score * 0.6) + (pattern_consistency * 0.4)
    
    return final_score


def analyze_time_signature_from_file(file_path):
    """
    Wrapper function para análisis desde archivo
    """
    return analyze_time_signature(file_path)


if __name__ == "__main__":
    # Test
    import sys
    if len(sys.argv) > 1:
        result = analyze_time_signature_from_file(sys.argv[1])
        print("\n" + "="*50)
        print(f"Time Signature: {result['time_signature']}")
        print(f"Confidence: {result['confidence']*100:.1f}%")
        print(f"Pattern: {result['detected_pattern']}")
        print("="*50)



