import React from 'react';

/** A woven M with a central routing point. */
export const ModelMeshLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" role="img" aria-label="ModelMesh logo">
    <rect x="1" y="1" width="46" height="46" rx="14" fill="#4F46E5" />
    <path d="M10 33V15l14 13 14-13v18" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 15h9m10 0h9" stroke="#A5B4FC" strokeWidth="4" strokeLinecap="round" />
    <circle cx="24" cy="28" r="3" fill="#C7D2FE" />
  </svg>
);
