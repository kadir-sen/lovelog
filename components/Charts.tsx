
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar, PolarRadiusAxis
} from 'recharts';
import { DailyStats, EmojiUsage, HourlyActivity, LoveWordStat, ResponseTimeBucket } from '../types';

const MALE_COLOR = "#3b82f6"; // Blue
const FEMALE_COLOR = "#ec4899"; // Pink

// Custom Tooltip Styles
const tooltipStyle = { 
  borderRadius: '12px', 
  border: 'none', 
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  padding: '10px'
};

export const HourlyActivityChart: React.FC<{ data: HourlyActivity[] }> = ({ data }) => {
  return (
    <div className="h-64 sm:h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce7f3" />
          <XAxis dataKey="hour" fontSize={10} tickFormatter={(val) => `${val}:00`} />
          <YAxis fontSize={10} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(val) => `Saat: ${val}:00`} />
          <Area type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" activeDot={{ r: 6 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const StackedDailyBarChart: React.FC<{ data: DailyStats[]; participants: string[]; onBarClick?: (date: string) => void; }> = ({ data, participants, onBarClick }) => {
  const chartData = data.map(d => ({
    date: d.date,
    ...d.breakdown
  }));

  return (
    <div className="h-80 w-full cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} onClick={(state) => state?.activePayload?.[0] && onBarClick?.(state.activePayload[0].payload.date)} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fce7f3" />
          <XAxis dataKey="date" hide />
          <YAxis fontSize={10} />
          <Tooltip 
            contentStyle={tooltipStyle}
            cursor={{fill: '#fdf2f8', opacity: 0.6}}
            labelFormatter={(label) => new Date(label).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Bar dataKey={participants[0]} stackId="a" fill={MALE_COLOR} name={participants[0]} radius={[0, 0, 0, 0]} />
          <Bar dataKey={participants[1]} stackId="a" fill={FEMALE_COLOR} name={participants[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const EmojiTrendChart: React.FC<{ data: EmojiUsage['timeline']; emoji: string }> = ({ data, emoji }) => {
  return (
    <div className="h-48 w-full">
      <p className="text-center font-bold text-gray-700 mb-2 text-sm">{emoji} Kullanım Trendi</p>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="date" hide />
          <YAxis fontSize={10} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => new Date(d).toLocaleDateString()} />
          <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ComparisonPieChart: React.FC<{ data: { name: string; value: number }[] }> = ({ data }) => {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? MALE_COLOR : FEMALE_COLOR} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// NEW: Response Time Distribution Chart
export const ResponseTimeChart: React.FC<{ data: ResponseTimeBucket[]; participants: string[] }> = ({ data, participants }) => {
  const chartData = data.map(d => ({
    range: d.range,
    ...d.counts
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="range" fontSize={11} tick={{fill: '#6b7280'}} />
          <YAxis fontSize={10} tick={{fill: '#6b7280'}} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Bar dataKey={participants[0]} fill={MALE_COLOR} name={participants[0]} radius={[4, 4, 0, 0]} />
          <Bar dataKey={participants[1]} fill={FEMALE_COLOR} name={participants[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// NEW: Love Words Visualizer (List based for better mobile view than chart)
export const LoveWordsList: React.FC<{ data: LoveWordStat[]; participants: string[] }> = ({ data, participants }) => {
  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="space-y-4 overflow-y-auto max-h-80 pr-2 custom-scrollbar">
      {data.map((item, idx) => {
        const p1Count = item.byParticipant[participants[0]] || 0;
        const p2Count = item.byParticipant[participants[1]] || 0;
        const total = p1Count + p2Count;
        
        const p1Percent = (p1Count / total) * 100;
        const p2Percent = (p2Count / total) * 100;

        return (
          <div key={idx} className="bg-white p-3 rounded-xl border border-pink-50 shadow-sm">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold text-blue-500 w-12 text-left">{p1Count}</span>
              <span className="font-bold text-gray-700 capitalize text-sm mx-2 text-center flex-1">"{item.word}"</span>
              <span className="text-xs font-bold text-pink-500 w-12 text-right">{p2Count}</span>
            </div>
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden flex">
              <div className="bg-blue-500 h-full" style={{ width: `${p1Percent}%` }}></div>
              <div className="bg-pink-500 h-full" style={{ width: `${p2Percent}%` }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
