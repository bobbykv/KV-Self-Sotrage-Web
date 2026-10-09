import { PageHeader } from "@/components/admin/LocationSwitcher";
import { ActionForm } from "@/components/ActionForm";
import { loadBrain } from "@/lib/brain";
import { getFaqMarkdown, parseFaq } from "@/lib/faq";
import { resetFaqAction, saveFaqAction } from "../actions";

export const metadata = { title: "FAQ / chat brain" };

export default async function AdminFaq() {
  const faq = await getFaqMarkdown();
  const cats = parseFaq(faq.markdown);
  const count = cats.reduce((n, c) => n + c.entries.length, 0);
  const brain = await loadBrain("retell");
  return (
    <>
      <PageHeader title="FAQ / chat brain">
        <a href="/faq" target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
          View FAQ page
        </a>
      </PageHeader>
      <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
        <p className="card p-4">
          This one FAQ powers the public <strong>/faq</strong> page, the <strong>website chat</strong> (built-in or Retell widget) and the <strong>Retell phone agent</strong>. Edit it once and all stay in sync.
        </p>
        <p className="card p-4">
          Source: <strong>{faq.source === "admin" ? "edited here" : "repo file agent-brain/faq.md"}</strong>
          {faq.updatedAt && ` · last saved ${faq.updatedAt.toLocaleString("en-CA", { timeZone: "America/Halifax", dateStyle: "medium", timeStyle: "short" })}`}
          <br />
          {cats.length} sections · {count} questions
        </p>
      </div>
      <ActionForm action={saveFaqAction} submitLabel="Save FAQ" pendingLabel="Saving…" buttonClassName="btn-primary" hideOnSuccess={false} className="card space-y-3 p-5">
        <p className="text-xs text-kv-muted">
          Format: <code># Section</code>, then <code>## Question</code> followed by the answer. Text inside <code>{"<!-- -->"}</code> is a private note and never shown to customers or the agents. Never put prices
          here — the chat and phone agent read live prices from SiteLink.
        </p>
        <textarea name="markdown" required rows={28} defaultValue={faq.markdown} className="input py-2 font-mono text-sm" aria-label="FAQ markdown" />
      </ActionForm>
      <details className="card mt-4 p-4">
        <summary className="cursor-pointer font-semibold text-kv-navy">Preview the full prompt the Retell phone agent receives</summary>
        <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap text-xs">{brain.prompt}</pre>
      </details>
      {faq.source === "admin" && (
        <form action={resetFaqAction} className="mt-4">
          <button className="btn-ghost btn-sm text-kv-red">Discard edits and use the repo file</button>
        </form>
      )}
    </>
  );
}
