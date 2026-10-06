import { ChatWidget } from "@/components/ChatWidget";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      {settings.maintenanceMode && (
        <div className="bg-kv-yellow px-4 py-2 text-center text-sm font-semibold text-kv-navy" role="status">
          {settings.maintenanceMessage}
        </div>
      )}
      <Header />
      {env.sitelinkMode === "mock" && <div className="bg-kv-yellow-light px-4 py-2 text-center text-sm text-kv-navy">Demonstration site: sizes, prices, and availability are examples. No real rental or access is created here.</div>}
      <main>{children}</main>
      <Footer />
      {settings.chatEnabled && <ChatWidget />}
    </>
  );
}
