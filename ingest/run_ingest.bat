@echo off
setlocal

REM --- go to project folder ---
cd /d "C:\Users\sahar\OneDrive\Documents\crytopulse\ingest"

REM --- Supabase DB env vars ---
set PGHOST=aws-0-us-west-2.pooler.supabase.com
set PGPORT=5432
set PGDATABASE=postgres
set PGUSER=postgres.nlznxrxmcjafqjmjxjbn
set PGPASSWORD=2019Ep0280US

REM --- Ingest settings ---
set SYMBOL=BTCUSD
set GRANULARITY=60
set BACKFILL_DAYS=1

REM --- run python from venv ---
call ".\.venv\Scripts\python.exe" ".\backfill_coinbase.py" >> ".\logs\ingest.log" 2>&1

endlocal
