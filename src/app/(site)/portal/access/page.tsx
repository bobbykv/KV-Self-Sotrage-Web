import type { Metadata } from "next";
import { PortalAccessForm } from "@/components/PortalAccessForm";
export const metadata: Metadata = { title: "Set up online access", robots: { index: false } };
export default function AccessPage() { return <PortalAccessForm />; }
