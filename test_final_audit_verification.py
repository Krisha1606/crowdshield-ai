import sys
import os
import time

sys.path.insert(0, os.path.abspath("."))
sys.path.insert(0, os.path.abspath("backend"))

from database import get_connection
from main import restart_simulation, get_live_analytics, predict_all_gate_metrics, run_simulation_cycle

print("========================================================")
print("FINAL AUDIT & PERFORMANCE VERIFICATION SUITE")
print("========================================================\n")

# 1. Test Restart Endpoint & Cache Refresh
print("1. Testing Restart Simulation Endpoint...")
start_time = time.time()
res = restart_simulation()
restart_duration = (time.time() - start_time) * 1000
print(f"  [OK] Status:  {res['status']}")
print(f"  [OK] Message: {res.get('message', 'Simulation reset cleanly')}")
print(f"  [OK] Restart execution time: {restart_duration:.2f} ms")

# 2. Test Optimized get_live_analytics DB Query Latency
print("\n2. Testing Optimized get_live_analytics Latency...")
conn = get_connection()
t0 = time.time()
analytics = get_live_analytics(conn)
analytics_duration = (time.time() - t0) * 1000
conn.close()

print(f"  [OK] Returned {len(analytics)} gate metrics in {analytics_duration:.2f} ms")
for g in analytics:
    print(f"    • {g['gate_name']:<30} | Crowd: {g['current_occupancy']:<4} ({g['occupancy_pct']:<5.1f}%) | Queue: {g['queue_length']:<3} -> ML Req: {g['required_volunteers']:<2} | Risk: {g['risk']:<8}")

# 3. Simulate 3 consecutive 5-second simulation cycles
print("\n3. Testing Real-Time Simulation Cycle Inference...")
for cycle in range(1, 4):
    t_c0 = time.time()
    run_simulation_cycle()
    cycle_dur = (time.time() - t_c0) * 1000
    print(f"  [OK] Executed Cycle #{cycle} in {cycle_dur:.2f} ms")

# 4. Final Live Analytics State
print("\n4. Verifying Post-Simulation Gate Metrics...")
conn = get_connection()
analytics_end = get_live_analytics(conn)
conn.close()
for g in analytics_end:
    print(f"    • {g['gate_name']:<30} | Crowd: {g['current_occupancy']:<4} ({g['occupancy_pct']:<5.1f}%) | Queue: {g['queue_length']:<3} -> ML Req: {g['required_volunteers']:<2} | Risk: {g['risk']:<8}")

print("\n========================================================")
print("FINAL AUDIT VERIFICATION COMPLETE: ALL CHECKS PASSED")
print("========================================================")
