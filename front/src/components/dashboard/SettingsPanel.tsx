"use client";

import { signOut } from "next-auth/react";

interface SettingsPanelProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export default function SettingsPanel({ user }: SettingsPanelProps) {
  return (
    <div className="glass-card">
      <p className="text-xs uppercase tracking-wider text-mint-glow/60 mb-5">Cuenta</p>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-mist-gray/50 block mb-1">Nombre</label>
          <p className="text-sm text-pure-light">{user.name || "Sin nombre"}</p>
        </div>

        <div>
          <label className="text-xs text-mist-gray/50 block mb-1">Email</label>
          <p className="text-sm text-pure-light">{user.email}</p>
        </div>

        <div className="pt-4 border-t border-midnight-tide">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="py-2.5 px-5 rounded-lg border border-red-400/20 text-red-400/80 text-sm hover:bg-red-400/10 transition-all"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
