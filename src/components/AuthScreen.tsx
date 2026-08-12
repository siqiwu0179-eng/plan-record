import { type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (name?: string) => void;
};

const normalizePhone = (value: string) => {
  const trimmed = value.trim();
  return trimmed.startsWith("+") ? trimmed : `+86${trimmed}`;
};

const toInternalEmail = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@plan-record.local`;
};

export function AuthScreen({ open, onClose, onAuthenticated }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose, open]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !isSupabaseConfigured) {
      setMessage("Supabase 尚未配置，请联系开发者。");
      return;
    }

    const nickname = name.trim();
    if (mode === "signup" && !nickname) {
      setMessage("第一次注册请填写昵称。");
      return;
    }

    setBusy(true);
    setMessage("");
    const normalizedPhone = normalizePhone(phone);
    const internalEmail = toInternalEmail(normalizedPhone);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: internalEmail, password })
      : await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: { data: { full_name: nickname, phone: normalizedPhone } },
        });
    setBusy(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("注册成功，但项目仍要求验证邮箱。请在 Supabase 中关闭 Confirm email。");
      return;
    }

    if (mode === "signup") {
      window.localStorage.setItem("plan-record-profile-name", nickname);
    }
    onAuthenticated(mode === "signup" ? nickname : undefined);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white p-7 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-8">
        <button
          type="button"
          aria-label="关闭登录窗口"
          onClick={onClose}
          disabled={busy}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X size={20} />
        </button>

        <p className="text-sm font-semibold tracking-widest text-indigo-500">PLAN-RECORD</p>
        <h2 id="auth-title" className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
          {mode === "signin" ? "欢迎回来" : "创建你的账户"}
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">手机号 + 密码，不使用短信验证码</p>
        <form className="mt-8 space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              昵称
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-950"
                value={name}
                maxLength={12}
                onChange={(event) => setName(event.target.value)}
                placeholder="首次注册昵称"
                autoComplete="nickname"
                required
              />
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            手机号
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-950"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="例如 13800138000"
              inputMode="tel"
              autoComplete="tel"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
            密码
            <span className="relative mt-2 block">
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-indigo-950"
                type={showPassword ? "text" : "password"}
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white"
                aria-label={showPassword ? "隐藏密码" : "查看密码"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          <button
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            disabled={busy}
          >
            {busy ? "处理中…" : mode === "signin" ? "登录" : "注册"}
          </button>
        </form>

        {message && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">{message}</p>}
        <button
          type="button"
          className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          onClick={() => {
            setMode((value) => (value === "signin" ? "signup" : "signin"));
            setMessage("");
          }}
        >
          {mode === "signin" ? "还没有账号？注册" : "已有账号？登录"}
        </button>
      </div>
    </div>
  );
}
