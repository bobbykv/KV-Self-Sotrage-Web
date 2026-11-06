"use server";
import { requestPortalAccess, completePortalAccess } from "@/lib/portal-access";
type State = { ok?: boolean; error?: string; message?: string };
export async function requestAccessAction(_previous: State, form: FormData): Promise<State> { return requestPortalAccess(form); }
export async function completeAccessAction(_previous: State, form: FormData): Promise<State> { return completePortalAccess(form); }
