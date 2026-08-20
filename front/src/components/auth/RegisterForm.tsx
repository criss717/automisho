"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SocialButtons from "./SocialButtons";

export default function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrarse");
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Error al registrarse. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="card">
        <h1 className="text-heading text-pure-light font-teodor mb-2 text-center">
          Crear cuenta
        </h1>
        <p className="text-body-sm text-mist-gray text-center mb-8">
          Únete a AutoMisho y encuentra tu coche ideal
        </p>

        <SocialButtons />

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
            <label htmlFor="name" className="block text-body-sm text-mist-gray mb-2">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-forest-depths border border-midnight-tide rounded-xl text-pure-light text-body-sm focus:outline-none focus:border-mint-glow/50 transition-colors"
              placeholder="Tu nombre"
            />
          </div>

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
              minLength={8}
              className="w-full px-4 py-3 bg-forest-depths border border-midnight-tide rounded-xl text-pure-light text-body-sm focus:outline-none focus:border-mint-glow/50 transition-colors"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-body-sm text-mist-gray mb-2">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-forest-depths border border-midnight-tide rounded-xl text-pure-light text-body-sm focus:outline-none focus:border-mint-glow/50 transition-colors"
              placeholder="Repite la contraseña"
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
              "Crear cuenta"
            )}
          </button>
        </form>

        <p className="text-body-sm text-mist-gray text-center mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-mint-glow hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
