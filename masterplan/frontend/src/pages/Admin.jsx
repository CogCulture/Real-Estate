import React, { useEffect, useState } from 'react';
import { ArrowLeft, Activity, Database, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Admin() {
  const [usageData, setUsageData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/ai/usage');
        if (!response.ok) throw new Error('Failed to fetch AI usage data');
        const data = await response.json();
        setUsageData(data);
      } catch (err) {
        toast.error('Could not load AI usage metrics');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsage();
  }, []);

  const totalCost = usageData.reduce((acc, curr) => acc + (curr.cost || 0), 0);
  const totalCalls = usageData.length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-slate-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
              <p className="text-sm text-slate-500">API Usage & Cost Tracking</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Total API Calls</p>
              <p className="text-2xl font-bold text-slate-800">{totalCalls}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Total Spend</p>
              <p className="text-2xl font-bold text-slate-800">${totalCost.toFixed(4)}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
              <Database size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Active Model</p>
              <p className="text-lg font-bold text-slate-800">Claude 3.5 Sonnet</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-800">API Usage Logs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-4">Date / Time</th>
                  <th className="px-6 py-4">Project ID</th>
                  <th className="px-6 py-4">Model</th>
                  <th className="px-6 py-4 text-right">Prompt / Output Tokens</th>
                  <th className="px-6 py-4 text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">Loading...</td>
                  </tr>
                ) : usageData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">No API usage recorded yet.</td>
                  </tr>
                ) : (
                  usageData.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                        {new Date(log.created_at.replace(' ', 'T') + 'Z').toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-bold">
                        {log.project_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {log.model}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600">
                        {log.prompt_tokens.toLocaleString()} / {log.completion_tokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-emerald-600 font-bold">
                        ${log.cost?.toFixed(4)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
