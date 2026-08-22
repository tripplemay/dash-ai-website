"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { getSafeReturnTo } from "@/lib/return-to";
import { BackgroundBeams } from "@/components/aceternity/background-beams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const t = useTranslations("login");
  const locale = useLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await authClient.signIn.username({ username, password });
    setLoading(false);
    if (error) {
      setError(t("failed"));
      return;
    }
    const returnTo = getSafeReturnTo(
      new URLSearchParams(window.location.search).get("returnTo"),
      locale,
      { allowBrowseApi: true }
    );
    window.location.replace(returnTo ?? `/${locale}`);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0A1232,#1B2A6B)] px-6">
      <BackgroundBeams />
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/img/logo/DASH-mark-dark_1024.png"
            alt="DASH AI"
            className="logo-rounded size-16 object-cover shadow-card"
          />
          <div className="mt-4 text-2xl font-extrabold tracking-[2px] text-white">{t("title")}</div>
          <div className="mt-1 text-[13px] tracking-widest text-[#9FB3E8]">{t("sub")}</div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl bg-white/95 p-7 shadow-[0_24px_60px_rgba(4,10,32,.45)] backdrop-blur"
        >
          <p className="text-[13px] leading-relaxed text-subtext">{t("desc")}</p>
          <div className="mt-5 space-y-1.5">
            <Label htmlFor="username">{t("username")}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("usernamePh")}
              autoComplete="username"
              required
              className="h-10"
            />
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPh")}
              autoComplete="current-password"
              required
              className="h-10"
            />
          </div>
          {error && <div className="mt-3 text-[13px] font-bold text-destructive">{error}</div>}
          <Button type="submit" disabled={loading} className="mt-5 h-10 w-full text-sm font-extrabold tracking-[4px]">
            {loading ? t("loading") : t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
