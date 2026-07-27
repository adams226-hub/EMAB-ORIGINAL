"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { signUpTenant, type SignupState } from "./actions";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";

const initialState: SignupState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Création en cours..." : "Créer mon compte entreprise"}
    </Button>
  );
}

export function SignupForm() {
  const [state, formAction] = useFormState(signUpTenant, initialState);

  if (state.success) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-medium text-emerald-800">Compte créé avec succès !</p>
        <p className="text-sm text-emerald-700">
          Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.
        </p>
        <Link href="/login" className="inline-block text-sm font-medium text-brand-600 hover:underline">
          Aller à la connexion →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <FormError message={state.error} />

      <div>
        <Label htmlFor="companyName">Nom de l&apos;entreprise</Label>
        <Input id="companyName" name="companyName" placeholder="Ma Boutique SARL" required autoFocus />
      </div>

      <div>
        <Label htmlFor="fullName">Votre nom complet</Label>
        <Input id="fullName" name="fullName" placeholder="Jean Dupont" required />
      </div>

      <div>
        <Label htmlFor="email">Adresse email</Label>
        <Input id="email" name="email" type="email" placeholder="vous@entreprise.com" required />
      </div>

      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" placeholder="8 caractères minimum" required minLength={8} />
      </div>

      <SubmitButton />

      <p className="text-center text-xs text-slate-400">
        14 jours d&apos;essai gratuit, sans carte bancaire.
      </p>
    </form>
  );
}
