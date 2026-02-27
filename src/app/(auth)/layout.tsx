export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#faf9f7] px-4 py-10">
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
