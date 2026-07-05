/* Decorative QR mock, matching the design's white module grid. */

const CELLS = [
  0, 2, 4, 5, 7, 9, 11, 12, 14, 15, 19, 21, 23, 25, 26, 28, 30, 33,
];

export function QrPlaceholder({ size = 120 }: { size?: number }) {
  return (
    <div
      className="rounded-xl bg-white grid grid-cols-6 grid-rows-6 gap-[2px]"
      style={{ width: size, height: size, padding: size / 12 }}
    >
      {Array.from({ length: 36 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[2px]"
          style={{ background: CELLS.includes(i) ? "#0B0C10" : "transparent" }}
        />
      ))}
    </div>
  );
}
