import os
from pathlib import Path
import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import roc_auc_score, accuracy_score
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
import joblib

def add_features(df: pd.DataFrame) -> pd.DataFrame:
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
    df["ma_60"] = df["close"].rolling(60).mean()
    df["ma_ratio_10_30"] = df["ma_10"] / df["ma_30"] - 1

    # volatility
    df["vol_30"] = df["ret_1"].rolling(30).std()
    df["vol_60"] = df["ret_1"].rolling(60).std()

    # volume features
    df["vol_ma_30"] = df["volume"].rolling(30).mean()
    df["vol_ratio"] = df["volume"] / df["vol_ma_30"] - 1

    return df

def make_target(df: pd.DataFrame, horizon: int = 60) -> pd.DataFrame:
    # direction of future return over horizon minutes
    df = df.copy()
    df["future_close"] = df["close"].shift(-horizon)
    df["future_ret"] = (df["future_close"] - df["close"]) / df["close"]
    df["y_up"] = (df["future_ret"] > 0).astype(int)
    return df

def train(symbol: str, horizon: int = 60):
    root = Path(__file__).resolve().parents[1]
    data_path = root / "ml" / "data" / f"{symbol}_ohlcv_1m.parquet"
    if not data_path.exists():
        raise FileNotFoundError(f"Missing {data_path}. Run export_ohlcv first.")

    df = pd.read_parquet(data_path)

    # Ensure expected columns exist
    # Your parquet likely has: bucket, open, high, low, close, volume
    df["bucket"] = pd.to_datetime(df["bucket"], utc=True, errors="coerce")
    df = df.dropna(subset=["bucket"])

    df = add_features(df)
    df = make_target(df, horizon=horizon)

    feature_cols = [
        "ret_1","ret_5","ret_15",
        "ma_ratio_10_30",
        "vol_30","vol_60",
        "vol_ratio"
    ]

    df = df.dropna(subset=feature_cols + ["y_up"])
    X = df[feature_cols].values
    y = df["y_up"].values

    # simple, strong baseline for direction prediction
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=2000))
    ])

    # quick time-series validation (last split only for reporting)
    tscv = TimeSeriesSplit(n_splits=5)
    aucs, accs = [], []
    for train_idx, test_idx in tscv.split(X):
        model.fit(X[train_idx], y[train_idx])
        proba = model.predict_proba(X[test_idx])[:, 1]
        pred = (proba >= 0.5).astype(int)
        aucs.append(roc_auc_score(y[test_idx], proba))
        accs.append(accuracy_score(y[test_idx], pred))

    model.fit(X, y)

    out_dir = root / "ml" / "models"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{symbol}_h{horizon}.joblib"
    joblib.dump({
        "symbol": symbol,
        "horizon": horizon,
        "feature_cols": feature_cols,
        "model": model,
        "metrics": {
            "auc_mean": float(np.mean(aucs)),
            "acc_mean": float(np.mean(accs)),
        },
        "trained_rows": int(len(df)),
        "trained_until": df["bucket"].max().isoformat(),
    }, out_path)

    print(f"Saved model -> {out_path}")
    print(f"AUC(mean)={np.mean(aucs):.3f}  ACC(mean)={np.mean(accs):.3f}  rows={len(df)}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python ml/train_forecast.py <SYMBOL> [HORIZON_MINUTES]")
        raise SystemExit(1)
    sym = sys.argv[1]
    horizon = int(sys.argv[2]) if len(sys.argv) >= 3 else 60
    train(sym, horizon=horizon)
