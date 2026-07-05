export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center sm:gap-6 sm:py-8 sm:px-4">
      <div className="w-full sm:w-auto">{children}</div>
    </div>
  );
}
