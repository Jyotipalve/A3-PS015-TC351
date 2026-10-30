import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  Network,
  History,
  Lightbulb,
  FileText,
  Search,
  Settings,
  X,
  Radio,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

export const navItems: NavItem[] = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Live Diagnosis', path: '/diagnosis', icon: Stethoscope },
  { name: 'Network Path', path: '/topology', icon: Network },
  { name: 'Evidence Explorer', path: '/evidence', icon: Search },
  { name: 'Resolution Guide', path: '/resolve', icon: Lightbulb },
  { name: 'ISP Evidence Report', path: '/reports', icon: FileText },
  { name: 'Diagnostic History', path: '/history', icon: History },
  { name: 'Agent Settings', path: '/settings', icon: Settings },
  { name: 'Fault Simulation Lab', path: '/simulation', icon: FlaskConical, tag: 'Preview' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  // Close mobile sidebar on navigation
  React.useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200/90 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-sky-700 text-white flex items-center justify-center shadow-xs">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight block">
                NetExplain
              </span>
              <span className="text-[10px] text-sky-800 font-semibold tracking-wide uppercase block -mt-0.5">
                Measure · Explain · Resolve
              </span>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Diagnostic Modules
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isOverview = item.path === '/';
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={isOverview}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-50 text-sky-900 border border-sky-100 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </div>
                {item.tag && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200/60 font-mono">
                    {item.tag}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer info: Smart Cities Hackathon info */}
        <div className="p-3.5 m-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
            <ShieldCheck className="h-3.5 w-3.5 text-sky-700" />
            <span>AIORI Hackathon 3</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Smart Cities Problem Statement <span className="font-mono font-medium text-slate-700">PS-015</span>
          </p>
          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
            <span>Measurement Engine</span>
            <span className="font-mono text-emerald-700 font-semibold">Active</span>
          </div>
        </div>
      </aside>
    </>
  );
};
