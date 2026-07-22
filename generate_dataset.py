"""
CrowdShield AI - Digital Twin Synthetic Dataset Generator
============================================================
Simulates large public-gathering / high-footfall-venue crowd dynamics
(concerts, stadiums, religious events, airports, stations, malls) as a
causally-linked system rather than independent random columns.

Core causal chains implemented:

    Weather -> Arrival Rate -> Queue Length -> Waiting Time
             -> Congestion Score -> Risk Score

    Crowd Count -> Occupancy -> Volunteer Requirement -> Volunteer Gap
                 -> Waiting Time -> Risk

    Security Delay -> Queue -> Waiting -> Congestion

    Medical Incident -> Emergency Response -> Volunteer Requirement -> Risk

Run:
    python generate_dataset.py
Output:
    crowd_dataset.csv  (~10,000 rows)
"""

import numpy as np
import pandas as pd

# ============================================================
# GLOBAL CONFIG
# ============================================================

N_ROWS = 10000
RANDOM_SEED = 42
rng = np.random.default_rng(RANDOM_SEED)

EVENT_TYPES = [
    "Concert", "Sports Event", "Religious Gathering", "Festival",
    "College Fest", "Exhibition", "Corporate Event", "Political Rally",
    "Marathon", "Airport Crowd", "Railway Station", "Metro Station",
    "Mall Weekend", "Food Court",
]
TIME_SLOTS = ["Morning", "Afternoon", "Evening", "Night"]
DAY_TYPES = ["Weekday", "Weekend", "Holiday", "Festival Day"]
WEATHER_TYPES = ["Sunny", "Cloudy", "Rain", "Storm", "Fog", "Extreme Heat"]

# Physical / operational constants (named, reused everywhere instead of
# scattering literals through formulas)
PERSONS_PER_SQM = 3.0            # safe crowd-density baseline for venue sizing
BASE_GATE_THROUGHPUT = 50        # people/min a 1m-wide gate passes at 100% efficiency
QUEUE_ACCUMULATION_WINDOW = 12   # minutes of demand/processing imbalance that build a queue
VOLUNTEER_RATIO_BASE = 0.008     # baseline volunteers required per attendee
SECURITY_RATIO_BASE = 0.010      # baseline security guards required per attendee
MEDICAL_RATIO_BASE = 0.004       # baseline medical staff required per attendee
POLICE_RATIO_BASE = 0.006        # baseline police personnel required per attendee
FIRE_TEAM_RATIO_BASE = 0.0015    # baseline fire-team members required per attendee
ERT_RATIO_BASE = 0.0025          # baseline emergency-response-team members per attendee
BASE_WALK_SPEED_MPS = 1.3        # free-flow adult walking speed (Fruin baseline)

# ------------------------------------------------------------
# Weather profiles - the single source of truth for every
# weather-driven effect (arrival, queue, movement, incidents, risk).
# ------------------------------------------------------------
WEATHER_PROFILES = {
    "Sunny":        dict(severity=0.0, vis_penalty=0.0, temp_offset=2,  wind_offset=0,  humidity_offset=-5, med_mult=1.00),
    "Cloudy":       dict(severity=0.5, vis_penalty=0.5, temp_offset=-1, wind_offset=2,  humidity_offset=5,  med_mult=1.00),
    "Rain":         dict(severity=2.0, vis_penalty=3.0, temp_offset=-4, wind_offset=5,  humidity_offset=20, med_mult=1.05),
    "Storm":        dict(severity=3.5, vis_penalty=5.0, temp_offset=-6, wind_offset=15, humidity_offset=25, med_mult=1.10),
    "Fog":          dict(severity=1.5, vis_penalty=6.0, temp_offset=-3, wind_offset=-2, humidity_offset=15, med_mult=1.00),
    "Extreme Heat": dict(severity=1.2, vis_penalty=0.0, temp_offset=12, wind_offset=-1, humidity_offset=-10, med_mult=1.40),
}

# ------------------------------------------------------------
# Event-type "personality" profiles - root cause of demographic mix,
# security posture, medical risk and crowd volatility per row.
# ------------------------------------------------------------
EVENT_PROFILES = {
    #                        occ_mean occ_std sec  family child senior vip  disab med_risk volat  capacity_scale
    "Concert":              dict(occ_mean=0.92, occ_std=0.08, security=4, family=0.15, children=0.05, senior=0.04, vip=0.08, disabled=0.02, med_risk=1.1, volatility=0.75, capacity_scale=20000),
    "Sports Event":          dict(occ_mean=0.88, occ_std=0.09, security=5, family=0.30, children=0.10, senior=0.08, vip=0.10, disabled=0.03, med_risk=1.0, volatility=0.65, capacity_scale=30000),
    "Religious Gathering":   dict(occ_mean=0.95, occ_std=0.06, security=2, family=0.55, children=0.15, senior=0.20, vip=0.02, disabled=0.06, med_risk=1.3, volatility=0.35, capacity_scale=50000),
    "Festival":              dict(occ_mean=0.85, occ_std=0.10, security=3, family=0.25, children=0.10, senior=0.06, vip=0.05, disabled=0.03, med_risk=1.0, volatility=0.70, capacity_scale=35000),
    "College Fest":          dict(occ_mean=0.80, occ_std=0.12, security=2, family=0.05, children=0.02, senior=0.01, vip=0.03, disabled=0.02, med_risk=0.8, volatility=0.60, capacity_scale=8000),
    "Exhibition":            dict(occ_mean=0.60, occ_std=0.15, security=1, family=0.35, children=0.08, senior=0.10, vip=0.06, disabled=0.04, med_risk=0.7, volatility=0.20, capacity_scale=5000),
    "Corporate Event":       dict(occ_mean=0.70, occ_std=0.10, security=2, family=0.05, children=0.01, senior=0.05, vip=0.20, disabled=0.02, med_risk=0.6, volatility=0.15, capacity_scale=3000),
    "Political Rally":       dict(occ_mean=0.90, occ_std=0.10, security=5, family=0.20, children=0.05, senior=0.12, vip=0.04, disabled=0.02, med_risk=1.1, volatility=0.85, capacity_scale=40000),
    "Marathon":              dict(occ_mean=0.75, occ_std=0.12, security=3, family=0.20, children=0.03, senior=0.06, vip=0.02, disabled=0.03, med_risk=1.2, volatility=0.30, capacity_scale=15000),
    "Airport Crowd":         dict(occ_mean=0.65, occ_std=0.12, security=5, family=0.30, children=0.10, senior=0.12, vip=0.10, disabled=0.05, med_risk=0.8, volatility=0.25, capacity_scale=12000),
    "Railway Station":       dict(occ_mean=0.70, occ_std=0.14, security=3, family=0.25, children=0.08, senior=0.15, vip=0.02, disabled=0.05, med_risk=0.8, volatility=0.40, capacity_scale=18000),
    "Metro Station":         dict(occ_mean=0.75, occ_std=0.14, security=2, family=0.15, children=0.05, senior=0.10, vip=0.01, disabled=0.04, med_risk=0.7, volatility=0.45, capacity_scale=10000),
    "Mall Weekend":          dict(occ_mean=0.65, occ_std=0.13, security=1, family=0.40, children=0.15, senior=0.08, vip=0.03, disabled=0.03, med_risk=0.6, volatility=0.25, capacity_scale=9000),
    "Food Court":            dict(occ_mean=0.60, occ_std=0.15, security=1, family=0.45, children=0.18, senior=0.07, vip=0.02, disabled=0.03, med_risk=0.6, volatility=0.30, capacity_scale=2500),
}

TIME_SLOT_PROFILES = {
    "Morning":   dict(peak_prob=0.20, temp_base=24, transport_load=0.55, arrival_factor=0.9),
    "Afternoon": dict(peak_prob=0.35, temp_base=32, transport_load=0.65, arrival_factor=1.0),
    "Evening":   dict(peak_prob=0.70, temp_base=27, transport_load=0.90, arrival_factor=1.3),
    "Night":     dict(peak_prob=0.45, temp_base=21, transport_load=0.40, arrival_factor=0.8),
}

# Day type mainly scales how much of venue capacity actually turns out
# and how loaded public transport runs.
DAY_TYPE_PROFILES = {
    "Weekday":      dict(turnout_mult=0.85, transport_mult=1.00),
    "Weekend":      dict(turnout_mult=1.05, transport_mult=1.15),
    "Holiday":      dict(turnout_mult=1.15, transport_mult=1.25),
    "Festival Day": dict(turnout_mult=1.25, transport_mult=1.35),
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clip(arr, lo, hi):
    return np.clip(arr, lo, hi)


def norm(arr, hi, lo=0.0):
    """Min-max normalise to 0-1 against a fixed theoretical cap."""
    return clip((arr - lo) / (hi - lo), 0.0, 1.0)


def noise(scale, size):
    """Gaussian noise, mean 0, given std-dev scale - adds realism without
    breaking the underlying causal signal."""
    return rng.normal(0, scale, size)


def profile_lookup(col, table, key):
    """Vectorised lookup of a numeric profile value per row's category."""
    return col.map(lambda c: table[c][key]).to_numpy(dtype=float)


# ============================================================
# SECTION 1: CORE CATEGORICAL DRIVERS (event, time, day, weather)
# ============================================================

def generate_core_categoricals(n):
    df = pd.DataFrame({
        "event_type": rng.choice(EVENT_TYPES, size=n),
        "time_slot": rng.choice(TIME_SLOTS, size=n),
        "day_type": rng.choice(DAY_TYPES, size=n, p=[0.45, 0.30, 0.15, 0.10]),
        "weather": rng.choice(WEATHER_TYPES, size=n,
                               p=[0.35, 0.25, 0.15, 0.07, 0.08, 0.10]),
    })
    df["weather_severity"] = profile_lookup(df["weather"], WEATHER_PROFILES, "severity")
    return df


# ============================================================
# SECTION 2: VENUE INFORMATION
# ============================================================

def generate_venue(df):
    n = len(df)
    sec_level = profile_lookup(df["event_type"], EVENT_PROFILES, "security")
    cap_scale = profile_lookup(df["event_type"], EVENT_PROFILES, "capacity_scale")

# Random event size
    event_size = rng.choice(
    ["Small", "Medium", "Large", "Mega"],
    size=n,
    p=[0.30, 0.40, 0.20, 0.10]
    )

    size_multiplier = np.select(
    [
        event_size == "Small",
        event_size == "Medium",
        event_size == "Large",
        event_size == "Mega"
    ],
    [
        0.15,   # Small
        0.45,   # Medium
        1.00,   # Large
        1.50    # Mega
    ]
    )

    df["venue_capacity"] = clip(
    cap_scale * size_multiplier * rng.lognormal(0.0, 0.35, n),
    300,
    150000
    ).round(0)

# Optional - useful for analysis
    df["event_size"] = event_size

    # Transit hubs and malls run indoor more often than open-air events.
    indoor_prob_map = {
        "Concert": 0.45, "Sports Event": 0.30, "Religious Gathering": 0.35,
        "Festival": 0.10, "College Fest": 0.55, "Exhibition": 0.85,
        "Corporate Event": 0.90, "Political Rally": 0.15, "Marathon": 0.05,
        "Airport Crowd": 0.95, "Railway Station": 0.60, "Metro Station": 0.90,
        "Mall Weekend": 0.95, "Food Court": 0.90,
    }
    indoor_prob = df["event_type"].map(indoor_prob_map).to_numpy(dtype=float)
    df["is_indoor"] = (rng.random(n) < indoor_prob).astype(int)

    density_adj = PERSONS_PER_SQM * (1 - 0.05 * (sec_level - 1))
    df["venue_size_sqm"] = clip(df["venue_capacity"] / density_adj * (1 + noise(0.05, n)), 150, None).round(0)

    df["entry_gates"] = clip(np.round(np.sqrt(df["venue_capacity"]) / 12 + noise(0.5, n)), 2, 60).astype(int)
    df["emergency_gates"] = clip(np.round(df["entry_gates"] * (0.3 + noise(0.05, n))), 1, 30).astype(int)

    # Gate width scales mildly with capacity/security investment; feeds gate throughput.
    df["gate_width_m"] = clip(1.0 + 0.00002 * df["venue_capacity"] + 0.05 * sec_level + noise(0.15, n), 0.8, 6.0).round(2)

    df["gate_efficiency"] = clip(
        0.92 - 0.06 * df["weather_severity"] + 0.01 * sec_level + noise(0.03, n), 0.35, 0.99
    )

    df["parking_capacity"] = clip(
        df["venue_capacity"] * (0.20 + (1 - df["is_indoor"]) * 0.15) * (1 + noise(0.08, n)), 30, None
    ).round(0)

    # Camera count scales with venue size and security posture; coverage
    # follows from camera density vs venue sprawl (finalised in Section 9).
    df["camera_count"] = clip(
        (df["venue_size_sqm"] / 400) * (0.8 + 0.1 * sec_level) + noise(3, n), 2, None
    ).round(0)

    return df


# ============================================================
# SECTION 3: ENVIRONMENTAL FEATURES (weather driven)
# ============================================================

def generate_environment(df):
    n = len(df)
    temp_base = profile_lookup(df["time_slot"], TIME_SLOT_PROFILES, "temp_base")
    temp_off = profile_lookup(df["weather"], WEATHER_PROFILES, "temp_offset")
    wind_off = profile_lookup(df["weather"], WEATHER_PROFILES, "wind_offset")
    hum_off = profile_lookup(df["weather"], WEATHER_PROFILES, "humidity_offset")
    vis_pen = profile_lookup(df["weather"], WEATHER_PROFILES, "vis_penalty")

    df["temperature_c"] = clip(temp_base + temp_off + noise(1.5, n), 5, 48).round(1)
    df["humidity_pct"] = clip(50 + hum_off + noise(5, n), 10, 100).round(1)

    rain_base = np.where(df["weather"].isin(["Rain", "Storm"]),
                          np.where(df["weather"] == "Storm", 22, 9), 0)
    df["rain_intensity_mm_hr"] = clip(rain_base + noise(3, n) * (rain_base > 0), 0, 90).round(1)

    df["wind_speed_kmh"] = clip(10 + wind_off * 1.4 + noise(3, n), 0, 130).round(1)

    night_penalty = (df["time_slot"] == "Night").astype(float) * 1.5
    df["visibility_km"] = clip(10 - vis_pen - 0.02 * df["wind_speed_kmh"] - night_penalty + noise(0.4, n), 0.2, 10).round(2)

    return df


# ============================================================
# SECTION 4: CROWD INFORMATION
# ============================================================

def generate_crowd(df):
    n = len(df)
    occ_mean = profile_lookup(df["event_type"], EVENT_PROFILES, "occ_mean")
    occ_std = profile_lookup(df["event_type"], EVENT_PROFILES, "occ_std")
    peak_prob = profile_lookup(df["time_slot"], TIME_SLOT_PROFILES, "peak_prob")
    turnout_mult = profile_lookup(df["day_type"], DAY_TYPE_PROFILES, "turnout_mult")

    weather_penalty = 0.04 * df["weather_severity"] * (1 - df["is_indoor"])
    occupancy_fraction = clip(
        rng.normal(occ_mean, occ_std, n) * turnout_mult - weather_penalty, 0.02, 1.08
    )

    df["crowd_count"] = clip(df["venue_capacity"] * occupancy_fraction,0,None)
    df["occupancy_pct"] = clip(df["crowd_count"] / df["venue_capacity"] * 100, 5, 112).round(1)

    peak_score = clip(peak_prob + 0.25 * norm(df["occupancy_pct"], 100), 0, 0.95)
    df["is_peak_hour"] = (rng.random(n) < peak_score).astype(int)

    df["crowd_density_per_sqm"] = clip(df["crowd_count"] / df["venue_size_sqm"], 0.05, 12).round(2)

    # Walking speed falls with density (Fruin-style relation), fog/rain and low visibility.
    df["avg_walking_speed_mps"] = clip(
        BASE_WALK_SPEED_MPS * (1 - 0.15 * norm(df["crowd_density_per_sqm"], 6))
        * (1 - 0.05 * df["weather_severity"]) * (0.6 + 0.4 * norm(df["visibility_km"], 10))
        + noise(0.05, n), 0.2, BASE_WALK_SPEED_MPS
    ).round(2)

    for col, key in [("family_pct", "family"), ("children_pct", "children"),
                      ("senior_citizen_pct", "senior"), ("vip_pct", "vip"),
                      ("disabled_pct", "disabled")]:
        mean_val = profile_lookup(df["event_type"], EVENT_PROFILES, key) * 100
        df[col] = clip(mean_val + noise(3, n), 0, 80).round(1)

    # Crowd behaviour index (0-1): volatility from event profile, density
    # pressure, heat stress and bad weather. Category label is DERIVED
    # from this score, never assigned independently.
    volatility = profile_lookup(df["event_type"], EVENT_PROFILES, "volatility")
    df["crowd_behavior_index"] = clip(
        0.40 * volatility + 0.25 * norm(df["occupancy_pct"], 100)
        + 0.15 * norm(df["crowd_density_per_sqm"], 6) + 0.10 * norm(df["temperature_c"], 48)
        + 0.10 * norm(df["weather_severity"], 3.5) + noise(0.05, n), 0, 1
    ).round(3)

    df["crowd_behavior"] = np.select(
        [df["crowd_behavior_index"] < 0.35, df["crowd_behavior_index"] < 0.60, df["crowd_behavior_index"] < 0.80],
        ["Calm", "Normal", "Aggressive"], default="Panic"
    )

    return df


# ============================================================
# SECTION 5: ENTRY SYSTEM
# ============================================================

def generate_entry_system(df):
    n = len(df)
    sec_level = profile_lookup(df["event_type"], EVENT_PROFILES, "security")
    arrival_factor = profile_lookup(df["time_slot"], TIME_SLOT_PROFILES, "arrival_factor")

    # Simulate real event entry patterns:
    # During peak hour: 40-60% of total crowd arrives within 20-30 minutes.
    # During off-peak: remaining crowd arrives gradually over 60-90 minutes.
    arrival_window_min = clip(
        np.where(df["is_peak_hour"] == 1, rng.uniform(20, 30, n), rng.uniform(60, 90, n)) + noise(2, n),
        15, None
    )
    arriving_fraction = np.where(df["is_peak_hour"] == 1, rng.uniform(0.40, 0.60, n), rng.uniform(0.15, 0.35, n))

    # Arrival Rate (people per minute) driven by Crowd Count, Peak Hour, Event Type, Time Slot & Weather
    df["arrival_rate_per_min"] = clip(
        ((df["crowd_count"] * arriving_fraction) / arrival_window_min) * arrival_factor
        * (1 - 0.05 * df["weather_severity"]) * (1 + noise(0.05, n)),
        0, None
    ).round(1)

    # Throughput per gate driven by efficiency and physical gate width
    df["gate_throughput_per_gate"] = clip(
        BASE_GATE_THROUGHPUT * df["gate_width_m"] * df["gate_efficiency"]
        * (1 - 0.05 * df["weather_severity"]) + noise(2, n), 8, None
    ).round(1)

    total_gate_capacity = df["entry_gates"] * df["gate_throughput_per_gate"]
    # Entry Rate (people per minute) capped by physical gate capacity
    df["entry_rate_per_min"] = np.minimum(df["arrival_rate_per_min"], total_gate_capacity).round(1)
    df["exit_rate_per_min"] = clip(
        df["entry_gates"] * df["gate_throughput_per_gate"] * (0.85 + noise(0.05, n)), 5, None
    ).round(1)

    df["security_check_time_sec"] = clip(6 + 4.5 * sec_level + noise(1.5, n), 3, 60).round(1)
    df["metal_detector_delay_sec"] = clip(2 + 1.8 * sec_level + 2 * norm(df["occupancy_pct"], 100) + noise(1, n), 1, 30).round(1)
    df["bag_check_delay_sec"] = clip(3 + 2.2 * sec_level + noise(1.2, n), 1, 40).round(1)

    df["device_failure_pct"] = clip(2 + 2.5 * df["weather_severity"] + noise(1, n), 0.2, 30).round(1)
    df["qr_failure_rate_pct"] = clip(
        4 + 3.5 * df["weather_severity"] + 0.03 * df["occupancy_pct"] + 0.5 * df["device_failure_pct"] + noise(1.5, n),
        0.5, 45
    ).round(1)
    df["manual_verification_pct"] = clip(df["qr_failure_rate_pct"] * 1.15 + noise(2, n), 0, 65).round(1)

    df["qr_scan_time_sec"] = clip(3 + 0.15 * df["qr_failure_rate_pct"] + noise(0.5, n), 1.5, 20).round(1)
    df["ticket_verification_time_sec"] = clip(
        df["qr_scan_time_sec"] * (1 - df["manual_verification_pct"] / 100)
        + 12 * (df["manual_verification_pct"] / 100) + noise(1, n), 2, 40
    ).round(1)

    return df


# ============================================================
# SECTION 6: SECURITY / VOLUNTEER STAFFING
# ============================================================

def generate_staffing(df):
    n = len(df)
    sec_level = profile_lookup(df["event_type"], EVENT_PROFILES, "security")
    med_risk = profile_lookup(df["event_type"], EVENT_PROFILES, "med_risk")

    size_factor = np.where(
        df["crowd_count"] < 3000, 1.00,
        np.where(
            df["crowd_count"] < 10000, 0.95,
            np.where(
                df["crowd_count"] < 25000, 0.90,
                0.85
            )
        )
    )

    base = (
        df["crowd_count"]
        * VOLUNTEER_RATIO_BASE
        * size_factor
        * (1 + 0.15 * norm(df["occupancy_pct"], 100))
        + 0.02 * sec_level * df["entry_gates"]
    )

    # Realistic minimum staffing policy
    base = np.where(df["crowd_count"] == 0, 1, base)
    base = np.where((df["crowd_count"] > 0) & (df["crowd_count"] <= 100), np.maximum(base, 2), base)
    base = np.where((df["crowd_count"] > 100) & (df["crowd_count"] <= 250), np.maximum(base, 3), base)

    df["base_required_volunteers"] = np.round(base)

    coverage_ratio = clip(rng.normal(0.85, 0.18, n), 0.35, 1.25)
    df["volunteers_assigned"] = clip(df["base_required_volunteers"] * coverage_ratio, 2, None).round(0)
    df["volunteer_gap"] = clip(df["base_required_volunteers"] - df["volunteers_assigned"], 0, None).round(0)
    df["reserve_volunteers"] = clip(
        df["volunteers_assigned"] * (0.08 + noise(0.03, n)) + 0.5 * df["volunteer_gap"], 0, None
    ).round(0)

    df["security_guards"] = clip(
        df["crowd_count"] * SECURITY_RATIO_BASE * (0.6 + 0.15 * sec_level) + noise(3, n), 2, None
    ).round(0)
    df["police_personnel"] = clip(
        df["crowd_count"] * POLICE_RATIO_BASE * (0.6 + 0.15 * sec_level) + noise(3, n), 1, None
    ).round(0)
    df["medical_staff"] = clip(
        df["crowd_count"] * MEDICAL_RATIO_BASE * med_risk + noise(2, n), 1, None
    ).round(0)
    df["fire_team"] = clip(
        df["crowd_count"] * FIRE_TEAM_RATIO_BASE * (0.7 + 0.1 * sec_level) + noise(1, n), 1, None
    ).round(0)
    df["emergency_response_team"] = clip(
        df["crowd_count"] * ERT_RATIO_BASE * (0.7 + 0.1 * sec_level) * med_risk + noise(1, n), 1, None
    ).round(0)

    return df


# ============================================================
# SECTION 7: QUEUE INFORMATION
# ============================================================

def generate_queue(df):
    n = len(df)
    total_gate_capacity = df["entry_gates"] * df["gate_throughput_per_gate"]

    # Causal queue formation:
    # If Arrival Rate > Total Gate Capacity -> queue increases (imbalance > 0).
    # If Entry Rate >= Arrival Rate -> queue remains zero or clears.
    imbalance = clip(df["arrival_rate_per_min"] - total_gate_capacity, 0, None)
    coverage = (df["volunteers_assigned"] / df["base_required_volunteers"].clip(lower=1)).clip(upper=1.3)
    volunteer_relief = clip(1 - 0.15 * norm(coverage, 1.3), 0.5, 1.2)

    df["queue_growth_rate_per_min"] = clip(
        imbalance * (1 + 0.08 * df["weather_severity"]) + np.where(imbalance > 0, noise(1, n), 0), 0, None
    ).round(1)

    df["queue_reduction_rate_per_min"] = clip(
        df["entry_rate_per_min"] * (2 - volunteer_relief) * 0.5 + noise(2, n), 1, None
    ).round(1)

    # Queue accumulates causally over peak accumulation window
    accumulation_window = rng.uniform(15, 25, n)
    queue_raw = imbalance * accumulation_window * volunteer_relief

    # Cap queue realistically to crowd size
    queue_cap = clip(0.5 * df["crowd_count"], 0, 6000)
    df["queue_length"] = np.where(imbalance == 0, 0, clip(queue_raw, 0, queue_cap)).round(0)

    processing_delay_min = (
        df["security_check_time_sec"] + df["metal_detector_delay_sec"]
        + df["bag_check_delay_sec"] + df["qr_scan_time_sec"]
    ) / 60.0

    base_drain_minutes = df["queue_length"] / df["entry_rate_per_min"].clip(lower=1)

    # Waiting Time (minutes) derived directly from Queue Length and Entry Rate:
    # Queue = 0 -> Immediate walk-through processing delay (0.2 to 1.0 min)
    # Queue > 0 -> Waiting Time = Queue / Entry Rate + processing delay + weather penalty
    df["avg_waiting_time_min"] = np.where(
        df["queue_length"] == 0,
        clip(processing_delay_min, 0.1, 1.0).round(1),
        clip(
            base_drain_minutes + processing_delay_min
            + 0.5 * df["weather_severity"] + 0.02 * df["qr_failure_rate_pct"]
            - 2.0 * (volunteer_relief - 1) + np.where(df["queue_length"] > 0, noise(0.5, n), 0),
            0.5, 180
        ).round(1)
    )

    df["max_waiting_time_min"] = np.where(
        df["avg_waiting_time_min"] == 0.0,
        0.0,
        clip(
            df["avg_waiting_time_min"] * (1.3 + 0.15 * df["weather_severity"] / 3.5),
            df["avg_waiting_time_min"], 260
        )
    ).round(1)

    return df


# ============================================================
# SECTION 8: INCIDENTS
# Target distribution: ~85-90% None, ~8-12% Minor, ~1-3% Major,
# probability driven by crowd pressure / weather / behaviour / queue.
# ============================================================

def generate_incidents(df):
    n = len(df)
    med_risk = profile_lookup(df["event_type"], EVENT_PROFILES, "med_risk")
    med_mult = profile_lookup(df["weather"], WEATHER_PROFILES, "med_mult")

    # Composite incident pressure (0-1): everything that makes an incident
    # more likely to occur at all.
    pressure = clip(
        0.25 * norm(df["occupancy_pct"], 112)
        + 0.20 * df["crowd_behavior_index"]
        + 0.15 * norm(df["weather_severity"], 3.5)
        + 0.15 * df["is_peak_hour"]
        + 0.15 * norm(df["queue_length"], 4000)
        + 0.10 * norm(df["avg_waiting_time_min"], 120),
        0, 1
    )

    # Tier probabilities calibrated so the population lands close to the
    # requested 85-90 / 8-12 / 1-3 split, tilted per-row by pressure.
    p_major = clip(0.010 + 0.05 * pressure, 0.002, 0.06)
    p_minor = clip(0.075 + 0.10 * pressure, 0.03, 0.18)
    p_none = clip(1 - p_major - p_minor, 0.70, 0.98)
    # renormalise so the three always sum to 1
    total = p_none + p_minor + p_major
    p_none, p_minor, p_major = p_none / total, p_minor / total, p_major / total

    draw = rng.random(n)
    # NOTE: "No Incident" is used instead of the string "None" because
    # pandas' default CSV reader treats the literal text "None" as a
    # missing value (NaN) on reload - that would silently corrupt this
    # column for anyone loading crowd_dataset.csv downstream.
    tier = np.where(draw < p_major, "Major",
            np.where(draw < p_major + p_minor, "Minor", "No Incident"))
    df["incident_tier"] = tier

    is_minor = (tier == "Minor")
    is_major = (tier == "Major")
    is_incident = is_minor | is_major

    # Lambdas scale up sharply for the Major tier.
    med_lambda = np.select(
        [is_major, is_minor], [1.2 + 2.0 * med_risk * med_mult, 0.2 + 0.5 * med_risk * med_mult], default=0.0
    )
    sec_lambda = np.select(
        [is_major, is_minor], [1.0 + 2.5 * df["crowd_behavior_index"], 0.15 + 0.4 * df["crowd_behavior_index"]], default=0.0
    )
    df["medical_incidents"] = rng.poisson(clip(med_lambda, 0, None))
    df["security_incidents"] = rng.poisson(clip(sec_lambda, 0, None))

    df["lost_child"] = ((rng.random(n) < np.where(is_major, 0.35, np.where(is_minor, 0.10, 0.0))) * (df["children_pct"] > 2)).astype(int)
    df["slip_and_fall"] = (rng.random(n) < np.where(is_major, 0.45, np.where(is_minor, 0.15, 0.005))).astype(int)

    # Infrastructure failures - elevated by storms/extreme weather and, for
    # network/power, by sheer crowd load on local systems.
    weather_fail_boost = df["weather_severity"] / 3.5
    df["equipment_failure"] = (rng.random(n) < clip(0.01 + 0.06 * weather_fail_boost * is_incident, 0, 0.25)).astype(int)
    df["gate_failure"] = (rng.random(n) < clip(0.008 + 0.04 * weather_fail_boost * is_incident, 0, 0.2)).astype(int)
    df["camera_failure"] = (rng.random(n) < clip(0.01 + 0.03 * weather_fail_boost, 0, 0.2)).astype(int)
    df["network_failure"] = (rng.random(n) < clip(0.01 + 0.00001 * df["crowd_count"] + 0.02 * weather_fail_boost, 0, 0.25)).astype(int)
    df["power_failure"] = (rng.random(n) < clip(0.005 + 0.05 * (df["weather"] == "Storm"), 0, 0.2)).astype(int)

    # Rare, severe events - only meaningfully possible within the Major tier.
    df["fire_alarm"] = ((rng.random(n) < np.where(is_major, 0.08, 0.002)) | (df["equipment_failure"] & df["power_failure"])).astype(int)
    df["stampede_alert"] = (rng.random(n) < np.where(is_major, 0.05 * df["crowd_behavior_index"], 0.0005)).astype(int)
    df["bomb_threat"] = (rng.random(n) < np.where(is_major, 0.01, 0.0002)).astype(int)
    df["emergency_evacuation"] = (
        (df["fire_alarm"] == 1) | (df["stampede_alert"] == 1) | (df["bomb_threat"] == 1) |
        (df["medical_incidents"] >= 4) | (df["security_incidents"] >= 4)
    ).astype(int)

    return df

def update_required_volunteers(df):

    df["required_volunteers"] = (
        df["base_required_volunteers"]

        + (df["queue_length"] / 25)

        + (df["medical_incidents"] * 2)

        + (df["security_incidents"] * 2)

        + (df["weather_severity"] * 1.5)

        + ((df["occupancy_pct"] - 70).clip(lower=0) / 10)

        + ((1 - df["gate_efficiency"]) * 8)
    ).round()

    df["required_volunteers"] = df["required_volunteers"].clip(
        lower=1
    )

    df["volunteer_gap"] = (
        df["required_volunteers"]
        - df["volunteers_assigned"]
    ).clip(lower=0)

    return df

# ===========================================================
# SECTION 9: AI CAMERA / SURVEILLANCE
# ============================================================

def generate_cameras(df):
    n = len(df)

    df["cctv_density_per_1000sqm"] = clip(df["camera_count"] / (df["venue_size_sqm"] / 1000), 0.3, 10).round(2)

    df["occlusion_pct"] = clip(
        10 + 4 * norm(df["crowd_density_per_sqm"], 6) + 6 * df["camera_failure"] + noise(2, n), 1, 60
    ).round(1)
    df["blind_spot_pct"] = clip(
        30 - 3.2 * df["cctv_density_per_1000sqm"] + 8 * (1 - df["is_indoor"])
        + 0.4 * df["occlusion_pct"] + noise(3, n), 2, 75
    ).round(1)
    df["camera_coverage_pct"] = clip(100 - df["blind_spot_pct"], 25, 98).round(1)

    night_penalty = (df["time_slot"] == "Night").astype(float) * 6
    df["ai_detection_confidence_pct"] = clip(
        55 + 0.35 * df["camera_coverage_pct"] + 3 * df["visibility_km"]
        - night_penalty - 15 * df["camera_failure"] + noise(3, n), 30, 99
    ).round(1)

    return df


# ============================================================
# SECTION 10: TRANSPORT
# ============================================================

def generate_transport(df):
    n = len(df)
    transport_load_factor = profile_lookup(df["time_slot"], TIME_SLOT_PROFILES, "transport_load")
    day_transport_mult = profile_lookup(df["day_type"], DAY_TYPE_PROFILES, "transport_mult")

    df["parking_occupancy_pct"] = clip(
        (df["crowd_count"] * 0.22) / df["parking_capacity"].clip(lower=1) * 100 + noise(4, n), 5, 130
    ).round(1)

    transit_events = {"Airport Crowd", "Railway Station", "Metro Station"}
    is_transit = df["event_type"].isin(transit_events).astype(float)

    df["bus_load_pct"] = clip(
        35 + transport_load_factor * 35 * day_transport_mult + 15 * (1 - is_transit) + noise(5, n), 10, 130
    ).round(1)
    df["metro_load_pct"] = clip(
        30 + transport_load_factor * 40 * day_transport_mult
        + 30 * (df["event_type"] == "Metro Station").astype(float) + noise(5, n), 10, 135
    ).round(1)
    df["railway_passenger_load_pct"] = clip(
        30 + transport_load_factor * 40 * day_transport_mult
        + 35 * (df["event_type"] == "Railway Station").astype(float) + noise(5, n), 10, 135
    ).round(1)

    df["road_traffic_index"] = clip(
        (0.4 * norm(df["parking_occupancy_pct"], 130) + 0.3 * norm(df["bus_load_pct"], 130)
         + 0.3 * norm(df["metro_load_pct"], 135) + 0.05 * df["weather_severity"] / 3.5 + noise(0.03, n)) * 100,
        0, 100
    ).round(1)

    return df


# ============================================================
# SECTION 11: AI TARGET VARIABLES
# ============================================================

def generate_targets(df):
    n = len(df)

    # Normalisation caps below are calibrated against the ~95th-99th
    # percentile of each driver's ACTUAL simulated range (not arbitrary
    # theoretical maximums), so a genuinely severe event saturates each
    # term near 1.0 instead of every row landing in a narrow low band.
    QUEUE_CAP = 2000            # people (severe-congestion 95th-pct territory)
    WAIT_CAP = 20                # minutes
    DENSITY_CAP = 3.5            # persons/sqm (near crush-density territory)
    INCIDENT_CAP = 6             # incident count

    # ---- Congestion Score (0-100) ----
    congestion_raw = (
        0.22 * norm(df["occupancy_pct"], 112)
        + 0.20 * norm(df["queue_length"], QUEUE_CAP)
        + 0.18 * norm(df["avg_waiting_time_min"], WAIT_CAP)
        + 0.10 * (1 - norm(df["entry_rate_per_min"], df["arrival_rate_per_min"].clip(lower=1)))
        + 0.09 * norm(df["gate_efficiency"].max() - df["gate_efficiency"], 0.6)
        + 0.08 * norm(df["medical_incidents"] + df["security_incidents"], INCIDENT_CAP)
        + 0.06 * (df["weather_severity"] / 3.5)
        + 0.04 * norm(df["crowd_density_per_sqm"], DENSITY_CAP)
        + 0.03 * df["is_peak_hour"]
    )
    df["congestion_score"] = clip(congestion_raw * 100 + noise(3, n), 0, 100).round(1)
    low_cutoff = df["congestion_score"].quantile(0.45)
    medium_cutoff = df["congestion_score"].quantile(0.80)

    df["congestion_level"] = np.select(
    [
            df["congestion_score"] < low_cutoff,
            df["congestion_score"] < medium_cutoff
    ],
    [
        "Low",
        "Medium"
    ],
    default="High"
)

    # ---- Risk Score (0-100) ----
    risk_raw = (
        0.15 * norm(df["occupancy_pct"], 112)
        + 0.12 * norm(df["avg_waiting_time_min"], WAIT_CAP)
        + 0.18 * norm(df["congestion_score"], 100)
        + 0.10 * norm(df["queue_length"], QUEUE_CAP)
        + 0.13 * norm(df["medical_incidents"], INCIDENT_CAP)
        + 0.10 * norm(df["security_incidents"], INCIDENT_CAP)
        + 0.07 * norm(df["volunteer_gap"], df["required_volunteers"].clip(lower=1))
        + 0.05 * (df["weather_severity"] / 3.5)
        + 0.05 * df["crowd_behavior_index"]
        + 0.05 * df["emergency_evacuation"]
    )
    df["risk_score"] = clip(risk_raw * 100 + noise(3, n), 0, 100).round(1)

    # Risk_Level is DATA-DRIVEN, not fixed-threshold: cutoffs are the
    # generated Risk_Score's own 45th and 80th percentiles. This keeps the
    # label assignment causally faithful (rank order is untouched - a row
    # with more incidents/occupancy/congestion always scores and ranks
    # higher) while guaranteeing a stable, realistic class split instead of
    # one that collapses whenever the raw score distribution shifts.
    # Target split: ~45% Safe / ~35% Warning / ~20% Dangerous.
    SAFE_PCTL = 0.45
    WARNING_PCTL = 0.80
    risk_safe_cutoff = df["risk_score"].quantile(SAFE_PCTL)
    risk_warning_cutoff = df["risk_score"].quantile(WARNING_PCTL)

    df["risk_level"] = np.select(
        [df["risk_score"] < risk_safe_cutoff, df["risk_score"] < risk_warning_cutoff],
        ["Safe", "Warning"],
        default="Dangerous"
    )

    return df


# ============================================================
# MAIN PIPELINE
# ============================================================

def generate_dataset(n_rows=N_ROWS):
    df = generate_core_categoricals(n_rows)
    df = generate_venue(df)
    df = generate_environment(df)
    df = generate_crowd(df)
    df = generate_entry_system(df)
    df = generate_staffing(df)
    df = generate_queue(df)
    df = generate_incidents(df)
    df = update_required_volunteers(df)
    df = generate_cameras(df)
    df = generate_transport(df)
    df = generate_targets(df)

    column_order = [
        # Core
        "event_type", "time_slot", "day_type", "weather", "weather_severity","event_size",
        # Venue
        "venue_capacity", "is_indoor", "venue_size_sqm", "entry_gates", "emergency_gates",
        "gate_width_m", "gate_efficiency", "parking_capacity", "camera_count",
        # Crowd
        "crowd_count", "occupancy_pct", "arrival_rate_per_min", "entry_rate_per_min", "exit_rate_per_min",
        "gate_throughput_per_gate",
        "is_peak_hour", "crowd_density_per_sqm", "avg_walking_speed_mps",
        "crowd_behavior_index", "crowd_behavior",
        "family_pct", "children_pct", "senior_citizen_pct", "vip_pct", "disabled_pct",
        # Security / staffing
        "security_guards", "police_personnel", "medical_staff", "fire_team", "emergency_response_team",
        # Entry system
        "qr_scan_time_sec", "security_check_time_sec", "metal_detector_delay_sec",
        "bag_check_delay_sec", "ticket_verification_time_sec", "manual_verification_pct",
        "qr_failure_rate_pct", "device_failure_pct",
        # Queue
        "queue_length", "queue_growth_rate_per_min", "queue_reduction_rate_per_min",
        "avg_waiting_time_min", "max_waiting_time_min",
        # AI camera
        "ai_detection_confidence_pct", "cctv_density_per_1000sqm", "blind_spot_pct",
        "occlusion_pct", "camera_coverage_pct",
        # Transport
        "parking_occupancy_pct", "road_traffic_index", "bus_load_pct",
        "metro_load_pct", "railway_passenger_load_pct",
        # Environment
        "temperature_c", "humidity_pct", "rain_intensity_mm_hr", "wind_speed_kmh", "visibility_km",
        # Incidents
        "incident_tier", "medical_incidents", "security_incidents", "lost_child", "slip_and_fall",
        "equipment_failure", "gate_failure", "camera_failure", "network_failure", "power_failure",
        "emergency_evacuation", "fire_alarm", "stampede_alert", "bomb_threat",
        # Volunteers
        "volunteers_assigned","base_required_volunteers", "required_volunteers", "volunteer_gap", "reserve_volunteers",
        # Targets
        "congestion_score", "congestion_level", "risk_score", "risk_level",
    ]
    seen = set()
    final_cols = [c for c in column_order if not (c in seen or seen.add(c))]

    return df[final_cols]


if __name__ == "__main__":
    dataset = generate_dataset(N_ROWS)
    output_path = "crowd_dataset.csv"
    print("Dataset Shape:", dataset.shape)
    dataset.to_csv(output_path, index=False)
    dataset.iloc[:1000].to_csv("test1000.csv", index=False)
    print("1000 rows saved")
    print("CSV Saved Successfully")
    print(f"Generated {len(dataset)} rows x {len(dataset.columns)} columns -> {output_path}")
    print(dataset["incident_tier"].value_counts(normalize=True).round(3))
    print(dataset[["risk_level", "congestion_level"]].apply(lambda c: c.value_counts(normalize=True).round(3)))