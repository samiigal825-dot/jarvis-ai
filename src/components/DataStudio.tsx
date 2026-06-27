'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { Database, Download, RefreshCcw } from 'lucide-react';

interface ChartData {
  title: string;
  type: 'bar' | 'line' | 'area';
  data: any[];
  xAxisKey: string;
  yAxisKeys: string[];
}

interface DataStudioProps {
  chartData: ChartData | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function DataStudio({ chartData }: DataStudioProps) {
  
  const renderChart = () => {
    if (!chartData || !chartData.data || chartData.data.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
          <Database size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
          <p>No Active Data Feeds</p>
          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>Waiting for Analyst subagent to emit chart data...</span>
        </div>
      );
    }

    const { type, data, xAxisKey, yAxisKeys } = chartData;

    return (
      <ResponsiveContainer width="100%" height="100%">
        {type === 'bar' ? (
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey={xAxisKey} stroke="#a1a1aa" fontSize={12} />
            <YAxis stroke="#a1a1aa" fontSize={12} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
            <Legend />
            {yAxisKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : type === 'line' ? (
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey={xAxisKey} stroke="#a1a1aa" fontSize={12} />
            <YAxis stroke="#a1a1aa" fontSize={12} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
            <Legend />
            {yAxisKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey={xAxisKey} stroke="#a1a1aa" fontSize={12} />
            <YAxis stroke="#a1a1aa" fontSize={12} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }} />
            <Legend />
            {yAxisKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.3} />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--background)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={16} color="var(--primary)" /> 
          {chartData ? chartData.title : 'Enterprise Data Studio'}
        </h3>
        {chartData && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-icon" title="Refresh"><RefreshCcw size={14} /></button>
            <button className="btn-icon" title="Export CSV"><Download size={14} /></button>
          </div>
        )}
      </div>
      
      <div style={{ flex: 1, padding: '16px' }}>
        {renderChart()}
      </div>
      
      {chartData && (
        <div style={{ height: '30%', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
           <div style={{ padding: '8px 16px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
             Raw Data View
           </div>
           <div style={{ overflow: 'auto', height: 'calc(100% - 33px)' }}>
             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
               <thead>
                 <tr>
                   <th style={{ padding: '8px', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>{chartData.xAxisKey}</th>
                   {chartData.yAxisKeys.map(key => (
                     <th key={key} style={{ padding: '8px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-secondary)' }}>{key}</th>
                   ))}
                 </tr>
               </thead>
               <tbody>
                 {chartData.data.map((row, i) => (
                   <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                     <td style={{ padding: '8px', color: 'var(--text-primary)' }}>{row[chartData.xAxisKey]}</td>
                     {chartData.yAxisKeys.map(key => (
                       <td key={key} style={{ padding: '8px', textAlign: 'right', color: 'var(--text-primary)' }}>{row[key]}</td>
                     ))}
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}
    </div>
  );
}
