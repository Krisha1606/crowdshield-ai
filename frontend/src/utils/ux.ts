export interface RiskColorStyles {
  bg: string;
  border: string;
  text: string;
  badge: string;
  dot: string;
  bar: string;
  cardGlow: string;
}

export const getRiskColor = (predicted_risk: string): RiskColorStyles => {
  switch (predicted_risk) {
    case 'Critical':
    case 'Dangerous':
      return {
        bg: 'bg-red-500/5',
        border: 'border-red-500/35',
        text: 'text-red-400',
        badge: 'bg-red-500/10 text-red-400 border border-red-500/20',
        dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
        bar: 'bg-red-500',
        cardGlow: 'shadow-[0_0_20px_rgba(239,68,68,0.08)]'
      };
    case 'High':
      return {
        bg: 'bg-orange-600/5',
        border: 'border-orange-600/35',
        text: 'text-orange-500',
        badge: 'bg-orange-600/10 text-orange-500 border border-orange-600/20',
        dot: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]',
        bar: 'bg-orange-500',
        cardGlow: 'shadow-[0_0_20px_rgba(249,115,22,0.08)]'
      };
    case 'Warning':
      return {
        bg: 'bg-orange-500/5',
        border: 'border-orange-500/35',
        text: 'text-orange-400',
        badge: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
        dot: 'bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.6)]',
        bar: 'bg-orange-400',
        cardGlow: 'shadow-[0_0_20px_rgba(249,115,22,0.08)]'
      };
    case 'Safe':
    default:
      return {
        bg: 'bg-success/5',
        border: 'border-success/35',
        text: 'text-success',
        badge: 'bg-success/10 text-success border border-success/20',
        dot: 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]',
        bar: 'bg-success',
        cardGlow: 'shadow-[0_0_20px_rgba(34,197,94,0.08)]'
      };
  }
};

export const getRiskBadge = (predicted_risk: string): string => {
  return getRiskColor(predicted_risk).badge;
};

export const getRecommendationBadge = (deficit: number): string => {
  return 'bg-transparent text-[#475569] font-medium';
};

export const getGateActionText = (dispatchStatus?: string, remainingDeficit: number = 0): string => {
  switch (dispatchStatus) {
    case 'arrived':         return 'Staffing Updated';
    case 'en_route':        return 'Volunteers En Route';
    case 'accepted':        return 'Volunteers Accepted';
    case 'dispatching':     return 'Dispatching...';
    case 'need_volunteers':
      return `Deploy ${remainingDeficit} More Volunteer${remainingDeficit !== 1 ? 's' : ''}`;
    case 'monitoring':
    default:
      return 'Maintain Current Staffing';
  }
};

export const getGateActionStyle = (predicted_risk: string, deficit: number = 0): string => {
  return 'bg-transparent text-[#475569] border-transparent font-medium';
};

