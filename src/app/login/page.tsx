import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white">
            E
          </div>
          <h1 className="text-xl font-semibold text-slate-900">EMAB ERP</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plateforme de gestion commerciale multi-magasins
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-slate-400">
          Accès réservé au personnel autorisé. Contactez votre administrateur pour obtenir un compte.
        </p>
      </div>
    </div>
  );
}
