import os
from pathlib import Path
import pandas as pd
import numpy as np
import joblib
import argparse

from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import roc_auc_score, accuracy_score, average_precision_score
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline


parser = argparse.ArgumentParser()
parser.add_argument("symbol", type=str)
parser.add_argument("horizon_minutes", type=int)
parser.add_argument(
    "--mode",
    type=str,
    default="A",
    choices=["A", "D"],
    help="A=direction (UP/DOWN), D=strong UP move signal",
)
parser.add_argument(
    "--thr",
    type=float,
    default=0.0025,
    help="Threshold for mode D as decimal return. 0.0025 = 0.25%%",
)
args = parser.parse_args()

symbol = args.symbol
H = args.horizon_minutes
mode = args.mode
thr = args.thr


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """Simple, stable feature set (works best so far)."""
    df = df.sort_values("bucket").copy()
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce")
    df = df.dropna(subset=["close"])

    # returns
    df["ret_1"] = df["close"].pct_change()
    df["ret_5"] = df["close"].pct_change(5)
    df["ret_15"] = df["close"].pct_change(15)

    # moving averages
    df["ma_10"] = df["close"].rolling(10).mean()
    df["ma_30"] = df["close"].rolling(30).mean()
    df["ma_ratio_10_30"] = df["ma_10"] / df["ma_30"] - 1

    # volatility
    df["vol_30"] = df["ret_1"].rolling(30).std()
    df["vol_60"] = df["ret_1"].rolling(60).std()

    # volume features
    df["vol_ma_30"] = df["volume"].rolling(30).mean()
    df["vol_ratio"] = df["volume"] / df["vol_ma_30"] - 1

    return df


def make_target(df: pd.DataFrame, horizon: int, mode: str, thr: float) -> pd.DataFrame:
    """
    Mode A: direction (future_ret > 0)
    Mode D: strong UP move (future_ret >= thr)
    """
    df = df.copy()
    df["future_close"] = df["close"].shift(-horizon)
    df["future_ret"] = (df["future_close"] / df["close"]) - 1.0

    if mode == "A":
        df["y"] = (df["future_ret"] > 0).astype(int)
    else:
        # strong UP move only (cleaner than abs move)
        df["y"] = (df["future_ret"] >= thr).astype(int)

    df = df.dropna(subset=["future_close", "future_ret", "y"])
    return df


def train(symbol: str, horizon: int, mode: str, thr: float):
    root = Path(__file__).resolve().parents[1]
    data_path = root / "ml" / "data" / f"{symbol}_ohlcv_1m.parquet"
    if not data_path.exists():
        raise FileNotFoundError(f"Missing {data_path}. Run export_ohlcv first.")

    df = pd.read_parquet(data_path)
    df["bucket"] = pd.to_datetime(df["bucket"], utc=True, errors="coerce")
    df = df.dropna(subset=["bucket"])

    df = add_features(df)
    df = make_target(df, horizon=horizon, mode=mode, thr=thr)

    feature_cols = [
        "ret_1",
        "ret_5",
        "ret_15",
        "ma_ratio_10_30",
        "vol_30",
        "vol_60",
        "vol_ratio",
    ]

    df = df.dropna(subset=feature_cols + ["y"])
    X = df[feature_cols].values
    y = df["y"].values

    print(f"[DEBUG] mode={mode} thr={thr} positive_rate={np.mean(y):.4f}")

    # Winning baseline: LogisticRegression + scaling
    model = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=2000)),
        ]
    )

    # Time-series CV
    tscv = TimeSeriesSplit(n_splits=5)
    aucs, accs, praucs = [], [], []
    for train_idx, test_idx in tscv.split(X):
        model.fit(X[train_idx], y[train_idx])
        proba = model.predict_proba(X[test_idx])[:, 1]
        pred = (proba >= 0.5).astype(int)

        aucs.append(roc_auc_score(y[test_idx], proba))
        accs.append(accuracy_score(y[test_idx], pred))
        praucs.append(average_precision_score(y[test_idx], proba))

    # Fit final model
    model.fit(X, y)

    out_dir = root / "ml" / "models"
    out_dir.mkdir(parents=True, exist_ok=True)

    if mode == "A":
        out_path = out_dir / f"{symbol}_h{horizon}_A.joblib"
    else:
        thr_tag = str(thr).replace(".", "p")
        out_path = out_dir / f"{symbol}_h{horizon}_D_thr{thr_tag}.joblib"
   
    payload = {
        "symbol": symbol,
        "horizon": horizon,
        "mode": mode,
        "thr": float(thr),
        "feature_cols": feature_cols,
        "model": model,
        "metrics": {
            "auc_mean": float(np.mean(aucs)),
            "acc_mean": float(np.mean(accs)),
            "prauc_mean": float(np.mean(praucs)),
            "prauc_baseline": float(np.mean(y)),
        },
        "trained_rows": int(len(df)),
        "trained_until": df["bucket"].max().isoformat(),
        "positive_rate": float(np.mean(y)) if len(y) else None,
    }

    joblib.dump(payload, out_path)

    print(f"Saved model -> {out_path}")
    print(
        f"mode={mode} thr={thr}  "
        f"AUC(mean)={np.mean(aucs):.3f}  "
        f"PR-AUC(mean)={np.mean(praucs):.3f}  baseline={np.mean(y):.3f}  "
        f"ACC(mean)={np.mean(accs):.3f}  rows={len(df)}"
    )


if __name__ == "__main__":
    train(symbol, horizon=H, mode=mode, thr=thr)