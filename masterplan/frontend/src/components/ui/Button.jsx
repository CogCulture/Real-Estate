import React from 'react';

export default function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '' }) {
  const baseStyle = "px-4 py-2 rounded-md font-semibold text-sm transition-all duration-300 transform active:scale-95 focus:outline-none flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:shadow-indigo-500/20 disabled:bg-indigo-800/50 disabled:text-slate-400 disabled:cursor-not-allowed",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed",
    danger: "bg-rose-600 hover:bg-rose-500 text-white disabled:bg-rose-800/50 disabled:cursor-not-allowed",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-emerald-800/50 disabled:cursor-not-allowed",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
