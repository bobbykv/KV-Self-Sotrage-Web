import { ChatWidget } from "@/components/ChatWidget";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getSettings } from "@/lib/settings";

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
      <main>{children}</main>
      <Footer />
      {settings.chatEnabled && <ChatWidget />}
    </>
  );
}
