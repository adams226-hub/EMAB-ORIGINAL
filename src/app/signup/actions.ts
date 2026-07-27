"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  companyName: z.string().min(2, "Le nom de l'entreprise est requis"),
  fullName: z.string().min(2, "Votre nom complet est requis"),
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export interface SignupState {
  error?: string;
  success?: boolean;
}

export async function signUpTenant(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    companyName: formData.get("companyName"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        tenant_name: parsed.data.companyName,
      },
    },
  });

  if (error) {
    return {
      error: error.message.includes("already registered")
        ? "Un compte existe déjà avec cet email"
        : error.message,
    };
  }

  return { success: true };
}
