"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SocialButtons from "./SocialButtons";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/chat";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email o contraseña incorrectos");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Error al iniciar sesión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="card">
        <h1 className="text-heading text-pure-light font-teodor mb-2 text-center">
          Iniciar sesión
        </h1>
        <p className="text-body-sm text-mist-gray text-center mb-8">
          Accede a tu cuenta de AutoMisho
        </p>

        <SocialButtons callbackUrl={callbackUrl} />

        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-midnight-tide" />
          <span className="text-caption text-mist-gray">o</span>
          <div className="flex-1 h-px bg-midnight-tide" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-body-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-body-sm text-mist-gray mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-forest-depths border border-midnight-tide rounded-xl text-pure-light text-body-sm focus:outline-none focus:border-mint-glow/50 transition-colors"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-body-sm text-mist-gray mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-forest-depths border border-midnight-tide rounded-xl text-pure-light text-body-sm focus:outline-none focus:border-mint-glow/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-pill btn-primary w-full"
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-forest-depths border-t-transparent rounded-full" />
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <p className="text-body-sm text-mist-gray text-center mt-6">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-mint-glow hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
