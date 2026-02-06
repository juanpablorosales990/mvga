export default function GridBackground({ children }: { children: React.ReactNode }) {
  return <div className="relative bg-grid min-h-screen">{children}</div>;
}
