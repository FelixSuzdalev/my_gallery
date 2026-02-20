// app/auth/check-email/CheckEmailClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckEmailClient({ email }: { email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [email]);

  const resend = async () => {
    if (!email) {
      setMessage("Email не указан в URL.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || json?.message || "Ошибка");
      setMessage("Письмо отправлено повторно.");
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const checkConfirmed = async () => {
    if (!email) {
      setMessage("Email не указан в URL.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/check-confirmation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (res.ok && json?.confirmed) {
        router.push("/login");
      } else {
        setMessage("Почта ещё не подтверждена. Проверьте ссылку в письме.");
      }
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl">
          <h2 className="text-lg font-bold mb-2">Параметр email не найден</h2>
          <p className="text-sm text-gray-600 mb-6">
            В URL не указан параметр <code>?email=...</code>. Проверьте ссылку в письме или вернитесь к входу.
          </p>
          <div className="space-y-3">
            <button onClick={() => router.push("/login")} className="w-full py-3 rounded-xl text-sm text-gray-600">
              Вернуться к входу
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl">
        <h2 className="text-lg font-bold mb-2">Проверьте почту</h2>
        <p className="text-sm text-gray-600 mb-6">
          Мы отправили письмо на <strong>{email}</strong>. Перейдите по ссылке в письме, чтобы подтвердить адрес.
        </p>

        {message && <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded">{message}</div>}

        <div className="space-y-3">
          <button onClick={resend} disabled={loading} className="w-full py-3 rounded-xl bg-black text-white">
            {loading ? "Отправка..." : "Отправить письмо повторно"}
          </button>
          <button onClick={checkConfirmed} disabled={loading} className="w-full py-3 rounded-xl border">
            Я подтвердил(а) — проверить
          </button>
          <button onClick={() => router.push("/login")} className="w-full py-3 rounded-xl text-sm text-gray-600">
            Вернуться к входу
          </button>
        </div>
      </div>
    </main>
  );
}