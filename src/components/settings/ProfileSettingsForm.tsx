"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { updateOwnProfile } from "@/app/(dashboard)/settings/actions";
import type { Profile } from "@/types/database.types";

export function ProfileSettingsForm({ profile }: { profile: Profile }) {
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(false);
    startTransition(async () => {
      const result = await updateOwnProfile({ full_name: fullName, phone });
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(undefined);
      setSuccess(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Profil mis à jour avec succès.
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={profile.email} disabled />
      </div>

      <div>
        <Label htmlFor="full_name">Nom complet</Label>
        <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div>
        <Label htmlFor="phone">Téléphone</Label>
        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer les modifications"}
      </Button>
    </form>
  );
}
