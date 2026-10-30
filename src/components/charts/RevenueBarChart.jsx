import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function RevenueBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barSize={22}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9f0ec" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7f78" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7f78" }} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e3ece7", fontSize: 12 }} cursor={{ fill: "rgba(16,185,129,0.06)" }} />
        <Bar dataKey="value" fill="#047857" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}