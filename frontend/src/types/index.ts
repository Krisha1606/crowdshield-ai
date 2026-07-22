export interface User {
  user_id: number;
  username: string;
  role: 'admin' | 'volunteer';
  email: string | null;
  full_name: string | null;
}

export interface Event {
  event_id: number;
  event_name: string;
  venue: string;
  date: string;
  capacity: number;
}

export interface Gate {
  gate_id: number;
  event_id: number;
  gate_name: string;
  max_capacity: number;
  current_occupancy: number;
  occupancy_percentage: number;
  queue_length: number;
  stationed_volunteers: number;
  predicted_wait_time: number;
  predicted_risk: 'Safe' | 'Warning' | 'Dangerous' | 'High' | 'Critical';
  required_volunteers: number;
  deficit: number;
  status: 'Open' | 'Busy' | 'Warning' | 'Critical' | 'Closed';
  congestion_level: 'Low' | 'Medium' | 'High';
  safety_score?: number;
  safety_label?: string;
  safety_color?: string;
  volunteers?: { volunteer_id: number; volunteer_name: string; contact: string }[];
  // Split transit counts (authoritative source of truth)
  pending_count?: number;
  accepted_count?: number;
  enroute_count?: number;
  arrived_count?: number;
  in_transit_count?: number;
  // Derived staffing metrics
  effective_staff?: number;
  remaining_deficit?: number;
  effective_deficit?: number;   // backward-compat alias for remaining_deficit
  dispatch_status?: string;
}

export interface Volunteer {
  volunteer_id: number;
  volunteer_name: string;
  assigned_gate: number | null;
  contact: string;
  email?: string | null;
  phone?: string | null;
  status?: 'Available' | 'Busy' | 'Break' | 'Offline' | 'En Route' | 'Pending' | 'Accepted' | 'Arrived';
  username?: string | null;
  last_login?: string | null;
  last_logout?: string | null;
  session_duration?: number;
  attendance_status?: string | null;
  profile_photo?: string | null;
  joining_date?: string | null;
  experience?: string | null;
}

export interface AssignmentRequest {
  request_id: number;
  volunteer_id: number;
  volunteer_name?: string;
  from_gate_id: number | null;
  from_gate_name?: string;
  to_gate_id: number;
  to_gate_name: string;
  reason: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Accepted' | 'Rejected' | 'Cancelled' | 'En Route' | 'Arrived' | 'Completed';
  created_at: string;
  updated_at?: string | null;
  accepted_at?: string | null;
  en_route_at?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  before_risk?: string | null;
  before_congestion?: string | null;
  before_queue?: number | null;
  before_wait_time?: number | null;
  before_deficit?: number | null;
  after_risk?: string | null;
  after_congestion?: string | null;
  after_queue?: number | null;
  after_wait_time?: number | null;
  after_deficit?: number | null;
  improvement_result?: string | null;
}

export interface VolunteerAlertAnnouncement {
  type: 'alert' | 'announcement' | 'notification';
  id: number;
  gate_id?: number;
  gate_name?: string;
  alert_type?: string;
  severity?: 'Critical' | 'High' | 'Medium' | 'Low';
  message: string;
  recommendation?: string;
  time: string;
  title?: string;
  priority?: 'Low' | 'Medium' | 'High';
  is_read?: boolean;
  notification_type?: string;
}

export interface Alert {
  alert_id: number;
  gate_id: number;
  gate_name: string;
  alert_type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  message: string;
  recommendation: string;
  is_resolved: number;
  alert_time: string;
  gate_status?: string;
}

export interface VolunteerAssignment {
  volunteer_id: number;
  volunteer_name: string;
  assigned_gate: number | null;
  gate_name: string;
  shift_timing: string;
  role: string;
  supervisor_name: string;
  duty_status: 'Active' | 'Completed' | 'Off Duty';
  status: string;
  contact: string;
  live_gate_status: GateLiveStatus | null;
}

export interface GateLiveStatus {
  gate_id: number;
  gate_name: string;
  max_capacity: number;
  current_occupancy: number;
  queue_size: number;
  predicted_wait_time: number;
  predicted_risk: 'Safe' | 'Warning' | 'Dangerous';
  congestion_status: 'Low' | 'Medium' | 'High';
  status?: string;
  deficit?: number;
}

export interface VolunteerChecklist {
  arrived_at_gate: number;
  qr_scanner_working: number;
  barricades_checked: number;
  crowd_flow_normal: number;
  emergency_exit_clear: number;
  communication_device_checked: number;
  shift_completed: number;
  submitted_at?: string | null;
  date: string;
}

export interface WorkReport {
  report_id: number;
  volunteer_id: number;
  volunteer_name?: string;
  gate_name?: string;
  date: string;
  tasks: string;
  crowd_situation: string;
  issues_faced: string;
  action_taken: string;
  suggestions?: string;
  additional_notes?: string;
  submitted_at: string;
}

export interface Notification {
  notification_id: number;
  volunteer_id: number;
  notification_type: 'Assignment' | 'Announcement' | 'Alert' | 'Reminder';
  title: string;
  message: string;
  related_id?: number | null;
  status: 'Unread' | 'Read' | 'Acknowledged';
  created_at: string;
  updated_at?: string | null;
}

export interface Announcement {
  announcement_id: number;
  title: string;
  message: string;
  priority: 'Low' | 'Medium' | 'High';
  created_at: string;
  is_read: boolean;
}

export interface Incident {
  incident_id?: number;
  volunteer_id?: number;
  volunteer_name?: string;
  incident_type: string;
  location: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  photo_url?: string | null;
  created_at?: string;
  is_resolved?: boolean;
}

export interface AttendanceStatus {
  attendance_id: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  date: string;
  is_checked_in: boolean;
}

export interface VolunteerPerformance {
  volunteer_id: number;
  volunteer_name: string;
  checklists_submitted: number;
  total_tasks_completed: number;
  incidents_filed: number;
  shifts_completed: number;
  operator_score: number;
}

export interface VolunteerMove {
  volunteer_id: number;
  volunteer_name: string;
  contact: string;
  from_gate: string;
  from_gate_id: number | null;
  distance_score: number;
  suitability_score?: number;
  est_travel_seconds?: number;
  explainable_reason?: string;
}

export interface StaffNotif {
  alert_id: number;
  gate_name: string;
  message: string;
  alert_time: string;
  is_resolved: number;
}

export interface GateAssignment {
  gate_id: number;
  gate_name: string;
  stationed_volunteers: number;
  required_volunteers: number;
  deficit: number;
  surplus: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  overload: boolean;
  risk: string;
  congestion: string;
  waiting_time: number;
  occupancy_pct: number;
  suggested_moves: VolunteerMove[];
  status: string;
  current_occupancy: number;
  queue_length: number;
  escalation_status: string;
  volunteers?: { volunteer_id: number; volunteer_name: string; contact: string }[];
  pending_count?: number;
  accepted_count?: number;
  enroute_count?: number;
  arrived_count?: number;
  in_transit_count?: number;
  effective_staff?: number;
  remaining_deficit?: number;
  effective_deficit?: number;
  dispatch_status?: string;
  max_capacity?: number;
}

export interface VolunteerEnriched {
  volunteer_id: number;
  volunteer_name: string;
  contact: string;
  assigned_gate: number | null;
  gate_name: string;
  status: 'Available' | 'Assigned' | 'Overloaded';
  gate_risk?: string;
  gate_congestion?: string;
  gate_occ_pct?: number;
  gate_deficit?: number;
  gate_priority?: string;
}

export interface OperationalKPIs {
  volunteer_utilization_pct: number;
  deployed_volunteers: number;
  total_active_volunteers: number;
  avg_response_time_seconds: number;
  avg_travel_time_seconds: number;
  allocation_efficiency_pct: number;
  venue_hazard_score: number;
  proactive_dispatches_active: number;
}

