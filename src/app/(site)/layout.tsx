import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SiteChat } from "@/components/SiteChat";
import { getSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { getRetellWidgetConfig } from "@/lib/retell";
import { showDraftNotices } from "@/lib/site-env";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const retell = getRetellWidgetConfig(env.APP_URL);
  return (
    <>
      {settings.maintenanceMode && (
        <div className="bg-kv-yellow px-4 py-2 text-center text-sm font-semibold text-kv-navy" role="status">
          {settings.maintenanceMessage}
        </div>
      )}
      <Header />
      {showDraftNotices() && (env.appTestMode || env.sitelinkMode === "mock") && (
        <div className="bg-kv-yellow-light px-4 py-2 text-center text-sm text-kv-navy">
          Demonstration site: sizes, prices, and availability are examples. No real rental or access is created here.
          {env.appTestMode && (
            <>
              {" "}
              <Link href="/testing" className="font-semibold underline">
                Test instructions &amp; portal login
              </Link>
            </>
          )}
        </div>
      )}
      <main>{children}</main>
      <Footer />
      {settings.chatEnabled && <SiteChat retell={retell} />}
    </>
  );
}
