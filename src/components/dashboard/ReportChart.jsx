import React from 'react';

// Native SVG keeps reports independent of chart-library or external service dependencies.
export default function ReportChart({ days, series, title }) {
  const width = 900; const height = 260; const left = 65; const right = 15; const top = 20; const bottom = 45;
  const values = days.flatMap(day => series.map(s => day[s.key]).filter(Number.isFinite));
  const minimum = Math.min(0, ...values); const maximum = Math.max(1, ...values);
  const y = value => top + (maximum - value) / (maximum - minimum) * (height - top - bottom);
  const groupWidth = (width - left - right) / Math.max(1, days.length);
  const barWidth = Math.min(28, groupWidth * .75 / series.length);
  return <div style={{ overflowX: 'auto' }}>
    <svg role="img" aria-label={title} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: 450, display: 'block' }}>
      <title>{title}. Amounts in Sri Lankan rupees; daily breakdown is available below.</title>
      {[minimum, (maximum + minimum) / 2, maximum].map((value, index) => <g key={index}>
        <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#e2e8f0" />
        <text x={left - 8} y={y(value) + 4} textAnchor="end" fontSize="11" fill="#64748b">{value.toLocaleString('en-LK', { maximumFractionDigits: 0 })}</text>
      </g>)}
      <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="#64748b" />
      {days.map((day, index) => <g key={day.date}>
        {series.map((s, position) => Number.isFinite(day[s.key]) && <rect key={s.key}
          x={left + index * groupWidth + (groupWidth - barWidth * series.length) / 2 + position * barWidth}
          y={Math.min(y(day[s.key]), y(0))} width={Math.max(1, barWidth - 1)} height={Math.abs(y(day[s.key]) - y(0))} fill={s.color}>
          <title>{day.date}: {s.label} LKR {day[s.key].toFixed(2)}</title>
        </rect>)}
        {index % Math.max(1, Math.ceil(days.length / 7)) === 0 && <text x={left + (index + .5) * groupWidth} y={height - 18} textAnchor="middle" fontSize="11" fill="#64748b">{day.date.slice(5)}</text>}
      </g>)}
    </svg>
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>{series.map(s => <span key={s.key}><span aria-hidden="true" style={{ color: s.color }}>■ </span>{s.label}</span>)}</div>
  </div>;
}
