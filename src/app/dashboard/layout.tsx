import MobileBottomNav from "@/components/dashboard/MobileBottomNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* pb-20 on mobile so content clears the bottom nav */}
      <div className="pb-20 md:pb-0">
        {children}
      </div>
      <MobileBottomNav />
    </>
  );
}
