import React from 'react';
/** Keep the exported identifier compatible with existing imports. */
export const ModelMeshLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" role="img" aria-label="hello logo">
    <circle cx="24" cy="24" r="22" fill="#102044" stroke="#8670ff" strokeWidth="3" />
    <path d="M11 23c0-6 8-6 8 0m10 0c0-6 8-6 8 0" stroke="#51e9ff" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M19 31q5 5 10 0" stroke="#51e9ff" strokeWidth="3" strokeLinecap="round" />
    <path d="M7 30a18 18 0 0 1 18-24" stroke="#72e7ff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
