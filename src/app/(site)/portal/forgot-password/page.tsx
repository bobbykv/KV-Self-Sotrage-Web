import type { Metadata } from "next";
import { PortalAccessForm } from "@/components/PortalAccessForm";
export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };
export default function ForgotPasswordPage() { return <PortalAccessForm reset />; }
