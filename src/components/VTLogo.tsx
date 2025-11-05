interface VTLogoProps {
  className?: string;
  variant?: 'chart' | 'candlestick' | 'minimal';
}

export const VTLogo = ({ className = "h-10 w-10", variant = 'chart' }: VTLogoProps) => {
  if (variant === 'chart') {
    return (
      <svg viewBox="0 0 120 120" className={className}>
        <defs>
          <linearGradient id="vtGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>
        
        <rect x="0" y="0" width="120" height="120" rx="24" fill="url(#vtGradient)"/>
        
        <path 
          d="M 20 80 L 35 65 L 50 70 L 65 50 L 80 55 L 100 30" 
          stroke="rgba(255,255,255,0.2)" 
          strokeWidth="3" 
          fill="none"
          strokeLinecap="round"
        />
        
        <text 
          x="60" 
          y="75" 
          fontSize="48" 
          fontWeight="900" 
          fill="white" 
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
        >VT</text>
        
        <path 
          d="M 95 35 L 100 30 L 105 35" 
          stroke="white" 
          strokeWidth="2.5" 
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (variant === 'candlestick') {
    return (
      <svg viewBox="0 0 120 120" className={className}>
        <defs>
          <linearGradient id="vtBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#065f46" />
          </linearGradient>
        </defs>
        
        <rect x="0" y="0" width="120" height="120" rx="20" fill="url(#vtBg)"/>
        
        <g opacity="0.2">
          <rect x="25" y="50" width="8" height="30" fill="white" rx="2"/>
          <line x1="29" y1="45" x2="29" y2="85" stroke="white" strokeWidth="2"/>
          
          <rect x="45" y="40" width="8" height="35" fill="white" rx="2"/>
          <line x1="49" y1="35" x2="49" y2="80" stroke="white" strokeWidth="2"/>
          
          <rect x="65" y="55" width="8" height="25" fill="white" rx="2"/>
          <line x1="69" y1="50" x2="69" y2="85" stroke="white" strokeWidth="2"/>
          
          <rect x="85" y="35" width="8" height="40" fill="white" rx="2"/>
          <line x1="89" y1="30" x2="89" y2="80" stroke="white" strokeWidth="2"/>
        </g>
        
        <text 
          x="60" 
          y="75" 
          fontSize="50" 
          fontWeight="900" 
          fill="white" 
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
        >VT</text>
      </svg>
    );
  }

  // minimal variant
  return (
    <svg viewBox="0 0 120 120" className={className}>
      <defs>
        <linearGradient id="circleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      
      <circle cx="60" cy="60" r="58" fill="url(#circleGrad)"/>
      
      <path 
        d="M 30 75 L 45 55 L 60 60 L 75 40 L 90 45" 
        stroke="rgba(255,255,255,0.15)" 
        strokeWidth="2.5" 
        fill="none"
        strokeLinecap="round"
      />
      
      <g transform="translate(60, 60)">
        <path 
          d="M -20 -15 L -5 15 L 0 10 L 5 15 L 20 -15" 
          stroke="white" 
          strokeWidth="7" 
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        <path 
          d="M 12 -15 L 28 -15 M 20 -15 L 20 15" 
          stroke="white" 
          strokeWidth="7" 
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};
