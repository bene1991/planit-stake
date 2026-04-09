import os
import json
import urllib.request
from datetime import datetime, timedelta

def get_env():
    env = {}
    with open('.env', 'r') as f:
        for line in f:
            if '=' in line:
                key, value = line.strip().split('=', 1)
                env[key] = value.replace('"', '').replace("'", "")
    return env

def analyze():
    env = get_env()
    url = env['VITE_SUPABASE_URL']
    key = env['SUPABASE_SERVICE_ROLE_KEY']
    
    since = "2026-04-09T00:00:00Z"
    
    all_logs = []
    page_size = 1000
    offset = 0
    
    print(f"Buscando logs reais desde {since}...")
    
    while True:
        endpoint = f"{url}/rest/v1/robot_execution_logs?created_at=gte.{since}&select=created_at,stage&order=created_at.asc&limit={page_size}&offset={offset}"
        req = urllib.request.Request(endpoint)
        req.add_header('apikey', key)
        req.add_header('Authorization', f'Bearer {key}')
        
        with urllib.request.urlopen(req) as response:
            page = json.loads(response.read().decode())
            if not page:
                break
            all_logs.extend(page)
            print(f"Recuperados {len(all_logs)} logs...")
            if len(page) < page_size:
                break
            offset += page_size
            if len(all_logs) >= 5000: # Safety cap
                break
                
    hourly_total = {}
    hourly_stats_calls = {}
    hourly_minutes = {}
    
    for l in all_logs:
        dt_str = l['created_at'].split('.')[0].replace('Z', '').split('+')[0]
        dt = datetime.strptime(dt_str, "%Y-%m-%dT%H:%M:%S")
        
        # Brasilia Time (-3)
        local_dt = dt - timedelta(hours=3)
        hour_key = local_dt.strftime("%Y-%m-%d %H:00")
        minute_key = local_dt.strftime("%Y-%m-%d %H:%M")
        
        hourly_total[hour_key] = hourly_total.get(hour_key, 0) + 1
        
        if hour_key not in hourly_minutes:
            hourly_minutes[hour_key] = set()
        hourly_minutes[hour_key].add(minute_key)
        
        if l['stage'] != 'DISCARDED_PRE_FILTER':
            hourly_stats_calls[hour_key] = hourly_stats_calls.get(hour_key, 0) + 1
            
    print("\n--- RELATÓRIO DE CONSUMO REAL COMPLETO (HORÁRIO BRASÍLIA) ---")
    print(f"{'Horário':<20} | {'Jogos Eval':<12} | {'Sinais/Stats':<12} | {'Mins Ativos':<12} | {'Est. Req API'}")
    print("-" * 85)
    
    all_hours = sorted(hourly_total.keys())
    
    for h in all_hours:
        evals = hourly_total[h]
        api = hourly_stats_calls.get(h, 0)
        mins_active = len(hourly_minutes[h])
        # Estimation: each active minute has 1 'live/all' call + the stats calls
        total_est = mins_active + api
        print(f"{h:<20} | {evals:<12} | {api:<12} | {mins_active:<12} | {total_est}")
        
    print("-" * 85)
    print("Nota: 'Jogos Eval' são todos os jogos ao vivo processados.")
    print("'Sinais/Stats' são jogos que passaram no pré-filtro de economia e chamaram a API de estatísticas.")

if __name__ == "__main__":
    analyze()
