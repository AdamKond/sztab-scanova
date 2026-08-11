// Prosty placeholder ładowania — jedna pulsująca belka.
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-line ${className}`} />;
}
