"use client";

import { useState } from "react";

export function TimingFields() {
  const [timing, setTiming] = useState("asap");
  return (
    <>
      <label>
        <span className="label">When do you need it?</span>
        <select name="timing" className="input" value={timing} onChange={(e) => setTiming(e.target.value)}>
          <option value="asap">As soon as possible</option>
          <option value="within_month">Within a month</option>
          <option value="flexible">I&apos;m flexible</option>
          <option value="specific_date">A specific date</option>
        </select>
      </label>
      {timing === "specific_date" && (
        <label>
          <span className="label">Date needed</span>
          <input type="date" name="specificDate" required className="input" />
        </label>
      )}
    </>
  );
}
