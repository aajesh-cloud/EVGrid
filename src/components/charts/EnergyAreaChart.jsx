import React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function EnergyAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="evEnergyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9f0ec" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7f78" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7f78" }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e3ece7", fontSize: 12 }} />
        <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={2.2} fill="url(#evEnergyFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}