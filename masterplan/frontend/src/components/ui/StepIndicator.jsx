import React from 'react';
import { Map, LayoutGrid, Box, ImageDown } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

export default function StepIndicator({ activeStep }) {
  const { projectId } = useParams();

  const steps = [
    { name: '1. Boundaries', icon: Map, path: projectId ? `/new-project?projectId=${projectId}` : '/new-project' },
    { name: '2. 2D Editor', icon: LayoutGrid, path: projectId ? `/editor/${projectId}` : null },
    { name: '3. 3D Preview', icon: Box, path: projectId ? `/preview/${projectId}` : null },
    { name: '4. Render', icon: ImageDown, path: projectId ? `/render/${projectId}` : null }
  ];

  return (
    <div className="flex flex-col items-center gap-3 py-4 px-6 bg-white border-b border-slate-200 shadow-sm">
      <h1 className="font-extrabold text-lg text-indigo-600 tracking-wider">
        MASTER<span className="text-slate-800">PLAN</span>
      </h1>

      <div className="flex items-center gap-8">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const stepNum = idx + 1;
          const isCompleted = stepNum < activeStep;
          const isActive = stepNum === activeStep;
          const isClickable = step.path && projectId;

          const baseClasses = "flex items-center gap-2 text-sm font-semibold transition-all duration-300";
          const colorClass = isActive 
            ? "text-indigo-600 font-bold" 
            : isCompleted 
              ? "text-emerald-600 hover:text-emerald-700" 
              : "text-slate-400 cursor-not-allowed";

          const content = (
            <span className={`${baseClasses} ${colorClass}`}>
              <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs border ${
                isActive 
                  ? "bg-indigo-600 border-indigo-600 text-white" 
                  : isCompleted 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                    : "border-slate-200 text-slate-400 bg-slate-50"
              }`}>
                {stepNum}
              </span>
              <Icon size={16} />
              {step.name}
            </span>
          );

          if (isClickable && !isActive) {
            return (
              <Link key={step.name} to={step.path}>
                {content}
              </Link>
            );
          }

          return <div key={step.name}>{content}</div>;
        })}
      </div>
    </div>
  );
}
