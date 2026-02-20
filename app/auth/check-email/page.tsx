// app/auth/check-email/page.tsx
import { Suspense } from "react";
import CheckEmailClient from "./CheckEmailClient";

type Props = {
  searchParams: { email?: string | string[] | undefined };
};

export default function Page({ searchParams }: Props) {
  const emailParam = searchParams?.email;
  const email =
    Array.isArray(emailParam) && emailParam.length > 0
      ? String(emailParam[0])
      : typeof emailParam === "string"
      ? emailParam
      : "";

  return (
    <Suspense fallback={<div>Загрузка...</div>}>
      <CheckEmailClient email={email} />
    </Suspense>
  );
}