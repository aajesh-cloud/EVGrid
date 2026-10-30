import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export default function BookingTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9f0ec" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7f78" }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b7f78" }} allowDecimals={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e3ece7", fontSize: 12 }} />
        <Line type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={2.4} dot={{ r: 3, fill: "#0d9488" }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}