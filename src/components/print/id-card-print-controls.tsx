"use client";

import { useState } from "react";

type PrintSide = "both" | "front" | "back";

export function IdCardPrintControls() {
  const [side, setSide] = useState<PrintSide>("both");

  function printSelectedSide() {
    document.documentElement.dataset.idCardPrintSide = side;
    const clearPrintSide = () => {
      delete document.documentElement.dataset.idCardPrintSide;
    };
    window.addEventListener("afterprint", clearPrintSide, { once: true });
    window.print();
  }

  return (
    <div className="student-id-card-print-controls no-print">
      <label>
        Print side
        <select
          value={side}
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (value === "both" || value === "front" || value === "back") setSide(value);
          }}
        >
          <option value="both">Both sides</option>
          <option value="front">Front side only</option>
          <option value="back">Back side only</option>
        </select>
      </label>
      <button className="student-primary-action" type="button" onClick={printSelectedSide}>
        Print selected side
      </button>
    </div>
  );
}
