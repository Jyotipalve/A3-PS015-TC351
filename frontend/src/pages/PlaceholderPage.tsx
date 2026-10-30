import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Construction, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
  upcomingFeatures: string[];
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  phase,
  description,
  upcomingFeatures,
}) => {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header breadcrumb & back */}
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-sky-700 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Overview</span>
        </Link>
      </div>

      {/* Main Announcement Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge variant="info" label={phase} />
              <span className="text-xs text-slate-500 font-medium">Coming in the next phase</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
              {description}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-sky-50 text-sky-700 border border-sky-100 self-start">
            <Construction className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>

        {/* Feature roadmap for this module */}
        <div className="mt-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Scheduled Implementation Blueprint
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingFeatures.map((feat, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-100 bg-slate-50/60 text-xs text-slate-700"
              >
                <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Honest Architecture Notice */}
        <div className="mt-8 p-4 rounded-lg bg-amber-50/60 border border-amber-200/80 flex items-start gap-3">
          <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold">Phase 1 Architecture Policy: </span>
            This foundation strictly avoids placeholder mock measurement data. Real network measurements, active diagnostic probing, and plain-language root-cause engines will be attached during subsequent milestones.
          </div>
        </div>
      </div>
    </div>
  );
};
