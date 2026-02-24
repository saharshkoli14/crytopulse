import json
import argparse
from pathlib import Path
import pandas as pd
import numpy as np
import joblib


parser = argparse.ArgumentParser()
parser.add_argument("symbol", type=str)
parser.add_argument("horizon_minutes", type=int)
parser.add_argument(
    "--mode",
    type=str,
    default="D",
    choices=["A", "D"],
    help="A=direction (UP/DOWN), D=strong UP move signal",
)
parser.add_argument(
    "--thr",
    type=float,
    default=0.0035,
    help="Threshold for mode D as decimal return. Example: 0.0035 = 0.35%%",
)
parser.add_argument(
    "--asof_rows",
    type=int,
    default=250,
    help="How many latest rows to load to compute features safely",
)
args = parser.parse_args()

symbol = args.symbol
H = args.horizon_minutes
mode = args.mode
thr = args.thr
asof_rows = args.asof_rows


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


def load_latest_feature_row(data_path: Path, feature_cols: list[str], asof_rows: int):
    df = pd.read_parquet(data_path)
    df["bucket"] = pd.to_datetime(df["bucket"], utc=True, errors="coerce")
    df = df.dropna(subset=["bucket"]).sort_values("bucket")

    df_tail = df.tail(asof_rows).copy()
    df_tail = add_features(df_tail)

    df_tail = df_tail.dropna(subset=feature_cols)
    if df_tail.empty:
        raise RuntimeError("Not enough recent data to compute features. Increase --asof_rows.")

    last = df_tail.iloc[-1]
    asof_bucket = last["bucket"]
    asof_close = float(last["close"])
    X = last[feature_cols].values.astype(float).reshape(1, -1)
    return asof_bucket, asof_close, X


def main():
    root = Path(__file__).resolve().parents[1]
    data_path = root / "ml" / "data" / f"{symbol}_ohlcv_1m.parquet"
    if not data_path.exists():
        out = {
            "ok": False,
            "error": "Missing data file for this symbol",
            "symbol": symbol,
            "expected_data_path": str(data_path),
            "hint": f"Run: python ml/export_ohlcv.py {symbol} 14",
        }
        print(json.dumps(out))
        return

    models_dir = root / "ml" / "models"

    # ✅ IMPORTANT CHANGE:
    # Mode A models should NOT use thr in the filename.
    if mode == "A":
        model_path = models_dir / f"{symbol}_h{H}_A.joblib"
    else:
        thr_tag = str(thr).replace(".", "p")
        model_path = models_dir / f"{symbol}_h{H}_D_thr{thr_tag}.joblib"

    if not model_path.exists():
        out = {
            "ok": False,
            "error": "Model not trained for this selection",
            "symbol": symbol,
            "horizon_minutes": H,
            "mode": mode,
            "thr": thr if mode == "D" else None,
            "expected_model_path": str(model_path),
            "train_command": (
                f"python ml/train_forecast.py {symbol} {H} --mode {mode}"
                + (f" --thr {thr}" if mode == "D" else "")
            ),
        }
        print(json.dumps(out))
        return

    payload = joblib.load(model_path)
    model = payload["model"]
    feature_cols = payload["feature_cols"]
    metrics = payload.get("metrics", {})

    asof_bucket, asof_close, X = load_latest_feature_row(data_path, feature_cols, asof_rows)

    prob = float(model.predict_proba(X)[:, 1][0])

    # confidence bands for dashboard
    if prob >= 0.70 or prob <= 0.30:
        conf = "HIGH"
    elif prob >= 0.60 or prob <= 0.40:
        conf = "MED"
    else:
        conf = "LOW"

    if mode == "A":
        out = {
            "ok": True,
            "symbol": symbol,
            "horizon_minutes": H,
            "mode": "A",
            "asof_bucket": asof_bucket.isoformat(),
            "asof_close": asof_close,
            "prob_up": prob,
            "direction": "UP" if prob >= 0.5 else "DOWN",
            "confidence": conf,
            "model_metrics": {
                "auc_mean": metrics.get("auc_mean"),
                "prauc_mean": metrics.get("prauc_mean"),
                "prauc_baseline": metrics.get("prauc_baseline"),
            },
        }
    else:
        out = {
            "ok": True,
            "symbol": symbol,
            "horizon_minutes": H,
            "mode": "D",
            "thr": thr,
            "asof_bucket": asof_bucket.isoformat(),
            "asof_close": asof_close,
            "prob_strong_up": prob,
            "signal": "STRONG_UP" if prob >= 0.5 else "NO_SIGNAL",
            "confidence": conf,
            "model_metrics": {
                "auc_mean": metrics.get("auc_mean"),
                "prauc_mean": metrics.get("prauc_mean"),
                "prauc_baseline": metrics.get("prauc_baseline"),
                "positive_rate": payload.get("positive_rate"),
            },
        }

    print(json.dumps(out))


if __name__ == "__main__":
    main()