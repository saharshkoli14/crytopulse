import sys
from pathlib import Path
import pandas as pd
import numpy as np
import joblib

def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values("bucket").copy()
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
    df = df.dropna(subset=["close"])

    df["ret_1"] = df["close"].pct_change()
    df["ret_5"] = df["close"].pct_change(5)
    df["ret_15"] = df["close"].pct_change(15)

    df["ma_10"] = df["close"].rolling(10).mean()
    df["ma_30"] = df["close"].rolling(30).mean()
    df["ma_ratio_10_30"] = df["ma_10"] / df["ma_30"] - 1

    df["vol_30"] = df["ret_1"].rolling(30).std()
    df["vol_60"] = df["ret_1"].rolling(60).std()

    df["vol_ma_30"] = df["volume"].rolling(30).mean()
    df["vol_ratio"] = df["volume"] / df["vol_ma_30"] - 1

    return df

def main(symbol: str, horizon: int):
    root = Path(__file__).resolve().parents[1]

    model_path = root / "ml" / "models" / f"{symbol}_h{horizon}.joblib"
    if not model_path.exists():
        raise RuntimeError(f"Model not found: {model_path}. Train first.")

    bundle = joblib.load(model_path)
    model = bundle["model"]
    feature_cols = bundle["feature_cols"]

    data_path = root / "ml" / "data" / f"{symbol}_ohlcv_1m.parquet"
    if not data_path.exists():
        raise RuntimeError(f"Data not found: {data_path}. Export first.")

    df = pd.read_parquet(data_path)
    df["bucket"] = pd.to_datetime(df["bucket"], utc=True, errors="coerce")
    df = df.dropna(subset=["bucket"])

    df = add_features(df)
    df = df.dropna(subset=feature_cols)

    last = df.iloc[-1]
    X = last[feature_cols].values.reshape(1, -1)

    p_up = float(model.predict_proba(X)[0, 1])
    direction = "UP" if p_up >= 0.5 else "DOWN"

    conf = abs(p_up - 0.5) * 2  # 0..1
    if conf >= 0.6:
        confidence = "HIGH"
    elif conf >= 0.35:
        confidence = "MED"
    else:
        confidence = "LOW"

    out = {
        "symbol": symbol,
        "horizon_minutes": horizon,
        "asof_bucket": last["bucket"].isoformat(),
        "asof_close": float(last["close"]),
        "prob_up": p_up,
        "direction": direction,
        "confidence": confidence,
        "model_metrics": bundle.get("metrics", {}),
    }

    # Print JSON to stdout (API will capture this)
    import json
    print(json.dumps(out))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ml/predict.py <SYMBOL> [HORIZON_MINUTES]")
        raise SystemExit(1)

    symbol = sys.argv[1]
    horizon = int(sys.argv[2]) if len(sys.argv) >= 3 else 60
    main(symbol, horizon)
