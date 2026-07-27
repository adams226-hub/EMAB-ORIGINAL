import Link from "next/link";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white">
            E
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Créer votre entreprise sur EMAB ERP</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestion commerciale multi-magasins, prête en quelques minutes.
          </p>
        </div>

        <SignupForm />

        <p className="mt-6 text-center text-xs text-slate-400">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
